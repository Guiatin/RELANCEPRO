import { pool } from '../config/db.js';
import { createAuditLog } from '../repositories/auditLogs.js';
import { findById as findClientById } from '../repositories/clients.js';
import { findSettingsById } from '../repositories/companies.js';
import { formatDocumentNumber, nextSequenceValue } from '../repositories/documentSequences.js';
import { findExistingIds as findExistingProductIds } from '../repositories/products.js';
import {
  create as insertQuote,
  findAllByCompany,
  findById,
  markSent as markQuoteSent,
  replaceItems,
  softDelete,
  updateHeader,
  updateStatus as updateQuoteStatus,
} from '../repositories/quotes.js';
import { buildQuotePdf } from '../templates/quotePdf.js';
import { addDays, todayInOuagadougou } from '../utils/dates.js';
import { AppError, conflict, validationError } from '../utils/errors.js';
import { MAX_AMOUNT, computeLine, computeTotals } from '../utils/money.js';
import { storage } from '../utils/storage/index.js';
import { parseCreateQuote, parseUpdateQuote } from '../validators/quotes.js';

const QUOTE_VALIDITY_DAYS = 30;

function tenant(context) {
  return {
    companyId: context.user.companyId,
    userId: context.user.id,
    ip: context.ip ?? null,
  };
}

function quoteNotFound() {
  return new AppError(404, 'NOT_FOUND', 'Devis introuvable.');
}

function clientNotFound() {
  return new AppError(404, 'NOT_FOUND', 'Client introuvable.');
}

function assertTotalsWithinBounds(totals) {
  const values = [totals.subtotal, totals.discountTotal, totals.taxTotal, totals.total];

  if (values.some((value) => value > MAX_AMOUNT)) {
    throw validationError([
      {
        field: 'items',
        message: 'Le total du devis ne doit pas dépasser 999 999 999 999 FCFA.',
      },
    ]);
  }
}

function buildItems(rawItems) {
  return rawItems.map((item) => {
    const line = computeLine({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountRate: item.discount_rate,
      taxRate: item.tax_rate,
    });

    return {
      productId: item.product_id ?? null,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit ?? null,
      unitPrice: item.unit_price,
      discountRate: item.discount_rate,
      taxRate: item.tax_rate,
      taxExemptionCode: item.tax_exemption_code ?? null,
      taxExemptionReason: item.tax_exemption_reason ?? null,
      ...line,
    };
  });
}

async function assertProductsExist(conn, companyId, items) {
  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];

  if (productIds.length === 0) return;

  const existing = await findExistingProductIds(conn, companyId, productIds);

  items.forEach((item, index) => {
    if (item.productId && !existing.has(item.productId)) {
      throw validationError([
        { field: `items.${index}.product_id`, message: 'Produit introuvable.' },
      ]);
    }
  });
}

function buildClientSnapshot(client) {
  return {
    name: client.name,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    whatsapp: client.whatsapp,
    address: client.address,
    city: client.city,
  };
}

function buildIssuerSnapshot(company) {
  return {
    name: company.name,
    legalName: company.legalName,
    taxId: company.taxId,
    tradeRegister: company.tradeRegister,
    email: company.email,
    phone: company.phone,
    address: company.address,
    city: company.city,
    country: company.country,
    currency: company.currency,
    logoPath: company.logoPath,
    taxExemptionMention: company.taxExemptionMention,
    documentFooter: company.documentFooter,
  };
}

export async function listQuotes(filters, context) {
  return findAllByCompany(pool, tenant(context).companyId, filters);
}

export async function getQuote(quoteId, context) {
  const quote = await findById(pool, tenant(context).companyId, quoteId);

  if (!quote) throw quoteNotFound();

  return quote;
}

async function loadLogo(logoPath) {
  if (!logoPath) return null;

  try {
    return await storage.get(logoPath);
  } catch {
    return null;
  }
}

export async function getQuotePdf(quoteId, context) {
  const { companyId } = tenant(context);
  const quote = await findById(pool, companyId, quoteId);

  if (!quote) throw quoteNotFound();

  const company = await findSettingsById(pool, companyId);
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Entreprise introuvable.');
  }

  const issuer = quote.issuerSnapshot ?? buildIssuerSnapshot(company);
  const client = quote.clientSnapshot ?? (await findClientById(pool, companyId, quote.clientId));

  if (!client) throw clientNotFound();

  const logo = await loadLogo(issuer.logoPath);

  return { quote, doc: buildQuotePdf({ quote, client, issuer, logo }) };
}

export async function createQuote(data, context) {
  const payload = parseCreateQuote(data);
  const { companyId, userId, ip } = tenant(context);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const client = await findClientById(conn, companyId, payload.client_id);
    if (!client) throw clientNotFound();

    const items = buildItems(payload.items ?? []);
    await assertProductsExist(conn, companyId, items);

    const totals = computeTotals(items);
    assertTotalsWithinBounds(totals);

    const quoteId = await insertQuote(conn, companyId, userId, {
      clientId: payload.client_id,
      notes: payload.notes ?? null,
      terms: payload.terms ?? null,
      clientReference: payload.client_reference ?? null,
      validUntil: payload.valid_until ?? null,
      ...totals,
    });

    if (items.length > 0) {
      await replaceItems(conn, companyId, quoteId, items);
    }

    await createAuditLog(conn, {
      companyId,
      userId,
      action: 'quote.create',
      entityType: 'quote',
      entityId: quoteId,
      metadata: { clientId: payload.client_id },
      ip,
    });

    await conn.commit();

    return findById(pool, companyId, quoteId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateQuote(quoteId, data, context) {
  const payload = parseUpdateQuote(data);
  const { companyId, userId, ip } = tenant(context);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const existing = await findById(conn, companyId, quoteId);
    if (!existing) throw quoteNotFound();
    if (existing.status !== 'draft') {
      throw conflict('Seul un devis en brouillon peut être modifié.');
    }

    if (payload.client_id !== undefined) {
      const client = await findClientById(conn, companyId, payload.client_id);
      if (!client) throw clientNotFound();
    }

    const header = {};

    if (payload.client_id !== undefined) header.clientId = payload.client_id;
    if (payload.notes !== undefined) header.notes = payload.notes;
    if (payload.terms !== undefined) header.terms = payload.terms;
    if (payload.client_reference !== undefined) {
      header.clientReference = payload.client_reference;
    }
    if (payload.valid_until !== undefined) header.validUntil = payload.valid_until;

    let items = null;

    if (payload.items !== undefined) {
      items = buildItems(payload.items);
      await assertProductsExist(conn, companyId, items);

      const totals = computeTotals(items);
      assertTotalsWithinBounds(totals);
      Object.assign(header, totals);
    }

    await updateHeader(conn, companyId, quoteId, header);

    if (items !== null) {
      await replaceItems(conn, companyId, quoteId, items);
    }

    await createAuditLog(conn, {
      companyId,
      userId,
      action: 'quote.update',
      entityType: 'quote',
      entityId: quoteId,
      ip,
    });

    await conn.commit();

    return findById(pool, companyId, quoteId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function deleteQuote(quoteId, context) {
  const { companyId, userId, ip } = tenant(context);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const existing = await findById(conn, companyId, quoteId);
    if (!existing) throw quoteNotFound();
    if (existing.status !== 'draft') {
      throw conflict('Seul un devis en brouillon peut être supprimé.');
    }

    await softDelete(conn, companyId, quoteId);

    await createAuditLog(conn, {
      companyId,
      userId,
      action: 'quote.delete',
      entityType: 'quote',
      entityId: quoteId,
      ip,
    });

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function markQuoteAsSent(quoteId, context) {
  const { companyId, userId, ip } = tenant(context);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const quote = await findById(conn, companyId, quoteId);
    if (!quote) throw quoteNotFound();
    if (quote.status !== 'draft') {
      throw conflict('Seul un devis en brouillon peut être envoyé.');
    }
    if (quote.items.length === 0) {
      throw validationError([
        { field: 'items', message: 'Au moins une ligne est requise pour envoyer le devis.' },
      ]);
    }

    const company = await findSettingsById(conn, companyId);
    if (!company) {
      throw new AppError(404, 'NOT_FOUND', 'Entreprise introuvable.');
    }

    const client = await findClientById(conn, companyId, quote.clientId);
    if (!client) throw clientNotFound();

    const issueDate = todayInOuagadougou();
    const validUntil = quote.validUntil ?? addDays(issueDate, QUOTE_VALIDITY_DAYS);
    const period = Number(issueDate.slice(0, 4));
    const sequence = await nextSequenceValue(conn, companyId, 'quote', period);
    const number = formatDocumentNumber(company.quotePrefix, period, sequence);

    const updated = await markQuoteSent(conn, companyId, quoteId, {
      number,
      issueDate,
      validUntil,
      clientSnapshot: buildClientSnapshot(client),
      issuerSnapshot: buildIssuerSnapshot(company),
    });

    if (!updated) {
      throw conflict('Le devis a été modifié entre-temps.');
    }

    await createAuditLog(conn, {
      companyId,
      userId,
      action: 'quote.sent',
      entityType: 'quote',
      entityId: quoteId,
      metadata: { number },
      ip,
    });

    await conn.commit();

    return findById(pool, companyId, quoteId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function changeQuoteStatus(quoteId, data, context) {
  const { companyId, userId, ip } = tenant(context);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const quote = await findById(conn, companyId, quoteId);
    if (!quote) throw quoteNotFound();
    if (quote.status !== 'sent') {
      throw conflict('Seul un devis envoyé peut être accepté ou refusé.');
    }

    const acceptedAt = data.status === 'accepted' ? new Date() : null;
    const updated = await updateQuoteStatus(conn, companyId, quoteId, {
      status: data.status,
      acceptedAt,
    });

    if (!updated) {
      throw conflict('Le devis a été modifié entre-temps.');
    }

    await createAuditLog(conn, {
      companyId,
      userId,
      action: `quote.${data.status}`,
      entityType: 'quote',
      entityId: quoteId,
      ip,
    });

    await conn.commit();

    return findById(pool, companyId, quoteId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
