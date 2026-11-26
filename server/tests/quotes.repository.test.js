import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../src/db/migrate.js';
import { formatDocumentNumber, nextSequenceValue } from '../src/repositories/documentSequences.js';
import {
  create,
  findAllByCompany,
  findById,
  markSent,
  replaceItems,
  softDelete,
  updateHeader,
  updateStatus,
} from '../src/repositories/quotes.js';

async function createCompany(name) {
  const [result] = await pool.execute('INSERT INTO companies (name) VALUES (?)', [name]);

  return String(result.insertId);
}

async function createUser(companyId, email) {
  const [result] = await pool.execute(
    'INSERT INTO users (company_id, full_name, email, password_hash) VALUES (?, ?, ?, ?)',
    [companyId, 'Test User', email, 'hash'],
  );

  return String(result.insertId);
}

async function createClient(companyId, userId, name) {
  const [result] = await pool.execute(
    'INSERT INTO clients (company_id, name, created_by) VALUES (?, ?, ?)',
    [companyId, name, userId],
  );

  return String(result.insertId);
}

async function cleanDatabase() {
  await pool.query('DELETE FROM quote_items');
  await pool.query('DELETE FROM quotes');
  await pool.query('DELETE FROM document_sequences');
  await pool.query('UPDATE sessions SET replaced_by_id = NULL');
  await pool.query('DELETE FROM products');
  await pool.query('DELETE FROM clients');
  await pool.query('DELETE FROM audit_logs');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM recovery_codes');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM companies');
}

const ITEMS = [
  {
    productId: null,
    description: 'Prestation',
    quantity: '2.00',
    unit: 'heure',
    unitPrice: 1000,
    discountRate: '0.00',
    taxRate: '18.00',
    taxExemptionCode: null,
    taxExemptionReason: null,
    lineSubtotal: 2000,
    lineDiscount: 0,
    lineTax: 360,
    lineTotal: 2360,
  },
];

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await pool.end();
});

describe('CRUD devis', () => {
  it('crée, lit, modifie puis supprime logiquement un brouillon', async () => {
    const companyId = await createCompany('Alpha');
    const userId = await createUser(companyId, 'a@example.com');
    const clientId = await createClient(companyId, userId, 'Awa');

    const quoteId = await create(pool, companyId, userId, {
      clientId,
      subtotal: 2000,
      discountTotal: 0,
      taxTotal: 360,
      total: 2360,
      clientReference: 'PO-1',
    });
    await replaceItems(pool, companyId, quoteId, ITEMS);

    const quote = await findById(pool, companyId, quoteId);
    expect(quote).toMatchObject({
      id: quoteId,
      companyId,
      clientId,
      clientName: 'Awa',
      status: 'draft',
      number: null,
      subtotal: 2000,
      taxTotal: 360,
      total: 2360,
      clientReference: 'PO-1',
    });
    expect(quote.items).toHaveLength(1);
    expect(quote.items[0]).toMatchObject({
      description: 'Prestation',
      quantity: '2.00',
      unitPrice: 1000,
      lineTotal: 2360,
    });

    const updated = await updateHeader(pool, companyId, quoteId, {
      notes: 'Note',
      total: 2360,
    });
    expect(updated).toBe(1);

    const list = await findAllByCompany(pool, companyId);
    expect(list.total).toBe(1);
    expect(list.data[0].clientName).toBe('Awa');
    expect(list.data[0].itemCount).toBe(1);

    expect(await softDelete(pool, companyId, quoteId)).toBe(true);
    expect(await findById(pool, companyId, quoteId)).toBeNull();
    expect((await findAllByCompany(pool, companyId)).total).toBe(0);
  });

  it('filtre par statut, client et référence', async () => {
    const companyId = await createCompany('Alpha');
    const userId = await createUser(companyId, 'a@example.com');
    const clientId = await createClient(companyId, userId, 'Awa');

    const first = await create(pool, companyId, userId, {
      clientId,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      clientReference: 'PO-ALPHA',
    });
    await create(pool, companyId, userId, {
      clientId,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
    });

    expect((await findAllByCompany(pool, companyId, { status: 'draft' })).total).toBe(2);
    expect((await findAllByCompany(pool, companyId, { status: 'sent' })).total).toBe(0);
    expect((await findAllByCompany(pool, companyId, { client_id: clientId })).total).toBe(2);
    expect((await findAllByCompany(pool, companyId, { reference: 'PO-ALPHA' })).total).toBe(1);

    const today = '2026-11-26';
    await markSent(pool, companyId, first, {
      number: 'DEV-2026-0001',
      issueDate: today,
      validUntil: '2026-12-26',
      clientSnapshot: { name: 'Awa' },
      issuerSnapshot: { name: 'Alpha' },
    });

    expect((await findAllByCompany(pool, companyId, { status: 'sent' })).total).toBe(1);
    expect((await findAllByCompany(pool, companyId, { from: today, to: today })).total).toBe(1);
  });
});

describe('Envoi et numérotation', () => {
  it('attribue un numéro et fige les instantanés', async () => {
    const companyId = await createCompany('Alpha');
    const userId = await createUser(companyId, 'a@example.com');
    const clientId = await createClient(companyId, userId, 'Awa');
    const quoteId = await create(pool, companyId, userId, {
      clientId,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
    });

    const sequence = await nextSequenceValue(pool, companyId, 'quote', 2026);
    expect(sequence).toBe(1);
    expect(formatDocumentNumber('DEV', 2026, sequence)).toBe('DEV-2026-0001');
    expect(await nextSequenceValue(pool, companyId, 'quote', 2026)).toBe(2);

    const updated = await markSent(pool, companyId, quoteId, {
      number: 'DEV-2026-0001',
      issueDate: '2026-11-26',
      validUntil: '2026-12-26',
      clientSnapshot: { name: 'Awa' },
      issuerSnapshot: { name: 'Alpha' },
    });
    expect(updated).toBe(true);

    const quote = await findById(pool, companyId, quoteId);
    expect(quote).toMatchObject({
      status: 'sent',
      number: 'DEV-2026-0001',
      issueDate: '2026-11-26',
      validUntil: '2026-12-26',
      clientSnapshot: { name: 'Awa' },
      issuerSnapshot: { name: 'Alpha' },
    });

    expect(
      await markSent(pool, companyId, quoteId, {
        number: 'DEV-2026-0002',
        issueDate: '2026-11-26',
        validUntil: '2026-12-26',
        clientSnapshot: {},
        issuerSnapshot: {},
      }),
    ).toBe(false);
  });

  it('protège le brouillon et applique les statuts', async () => {
    const companyId = await createCompany('Alpha');
    const userId = await createUser(companyId, 'a@example.com');
    const clientId = await createClient(companyId, userId, 'Awa');
    const quoteId = await create(pool, companyId, userId, {
      clientId,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
    });

    await markSent(pool, companyId, quoteId, {
      number: 'DEV-2026-0001',
      issueDate: '2026-11-26',
      validUntil: '2026-12-26',
      clientSnapshot: {},
      issuerSnapshot: {},
    });

    expect(await updateHeader(pool, companyId, quoteId, { notes: 'x' })).toBe(0);
    expect(await softDelete(pool, companyId, quoteId)).toBe(false);

    expect(
      await updateStatus(pool, companyId, quoteId, {
        status: 'accepted',
        acceptedAt: new Date('2026-11-27T10:00:00Z'),
      }),
    ).toBe(true);

    const quote = await findById(pool, companyId, quoteId);
    expect(quote.status).toBe('accepted');
    expect(quote.acceptedAt).not.toBeNull();
  });
});

describe('Isolation multi-tenant', () => {
  it('interdit de lire ou modifier le devis d’une autre entreprise', async () => {
    const alpha = await createCompany('Alpha');
    const alphaUser = await createUser(alpha, 'a@example.com');
    const alphaClient = await createClient(alpha, alphaUser, 'Awa');

    const beta = await createCompany('Beta');
    await createUser(beta, 'b@example.com');

    const quoteId = await create(pool, alpha, alphaUser, {
      clientId: alphaClient,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
    });

    expect(await findById(pool, beta, quoteId)).toBeNull();
    expect((await findAllByCompany(pool, beta)).total).toBe(0);
    expect(await updateHeader(pool, beta, quoteId, { notes: 'vol' })).toBe(0);
    expect(await softDelete(pool, beta, quoteId)).toBe(false);
    expect((await findById(pool, alpha, quoteId)).notes).toBeNull();
    expect((await findAllByCompany(pool, alpha)).total).toBe(1);
  });
});
