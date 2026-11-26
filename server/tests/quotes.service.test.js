import { beforeEach, describe, expect, it, vi } from 'vitest';

const conn = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
};

vi.mock('../src/config/db.js', () => ({
  pool: { getConnection: vi.fn(), execute: vi.fn() },
}));

vi.mock('../src/repositories/quotes.js', () => ({
  create: vi.fn(),
  findAllByCompany: vi.fn(),
  findById: vi.fn(),
  markSent: vi.fn(),
  replaceItems: vi.fn(),
  softDelete: vi.fn(),
  updateHeader: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock('../src/repositories/clients.js', () => ({ findById: vi.fn() }));
vi.mock('../src/repositories/companies.js', () => ({ findSettingsById: vi.fn() }));
vi.mock('../src/repositories/documentSequences.js', () => ({
  nextSequenceValue: vi.fn(),
  formatDocumentNumber: vi.fn(),
}));
vi.mock('../src/repositories/products.js', () => ({ findExistingIds: vi.fn() }));
vi.mock('../src/repositories/auditLogs.js', () => ({ createAuditLog: vi.fn() }));

import { pool } from '../src/config/db.js';
import { createAuditLog } from '../src/repositories/auditLogs.js';
import { findById as findClientById } from '../src/repositories/clients.js';
import { findSettingsById } from '../src/repositories/companies.js';
import { formatDocumentNumber, nextSequenceValue } from '../src/repositories/documentSequences.js';
import { findExistingIds as findExistingProductIds } from '../src/repositories/products.js';
import * as quotesRepository from '../src/repositories/quotes.js';
import {
  changeQuoteStatus,
  createQuote,
  getQuote,
  listQuotes,
  markQuoteAsSent,
  updateQuote,
} from '../src/services/quotes.js';

const CONTEXT = { user: { id: '7', companyId: '3' }, ip: '127.0.0.1' };

const CLIENT = {
  id: '5',
  name: 'Awa',
  contactName: null,
  email: null,
  phone: null,
  whatsapp: null,
  address: null,
  city: null,
};

const COMPANY = {
  id: '3',
  name: 'Alpha',
  legalName: null,
  taxId: null,
  tradeRegister: null,
  email: null,
  phone: null,
  address: null,
  city: null,
  country: 'BF',
  currency: 'XOF',
  logoPath: null,
  quotePrefix: 'DEV',
  invoicePrefix: 'FAC',
  paymentTermsDays: 30,
  taxExemptionMention: null,
  documentFooter: null,
};

const QUOTE = {
  id: '42',
  companyId: '3',
  clientId: '5',
  clientName: 'Awa',
  status: 'draft',
  number: null,
  validUntil: null,
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  pool.getConnection.mockResolvedValue(conn);
});

describe('listQuotes / getQuote', () => {
  it('transmet le companyId du contexte', async () => {
    const result = { data: [QUOTE], total: 1 };
    quotesRepository.findAllByCompany.mockResolvedValue(result);

    expect(await listQuotes({ status: 'draft' }, CONTEXT)).toBe(result);
    expect(quotesRepository.findAllByCompany).toHaveBeenCalledWith(pool, '3', { status: 'draft' });
  });

  it('renvoie 404 si le devis est introuvable', async () => {
    quotesRepository.findById.mockResolvedValue(null);

    await expect(getQuote('42', CONTEXT)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('createQuote', () => {
  it('crée un brouillon, calcule les totaux et journalise', async () => {
    findClientById.mockResolvedValue(CLIENT);
    quotesRepository.create.mockResolvedValue('42');
    quotesRepository.findById.mockResolvedValue({ ...QUOTE, items: [] });

    await createQuote(
      {
        client_id: '5',
        items: [
          {
            description: 'Prestation',
            quantity: '2',
            unit_price: 1000,
            tax_rate: '18',
          },
        ],
      },
      CONTEXT,
    );

    expect(quotesRepository.create).toHaveBeenCalledWith(
      conn,
      '3',
      '7',
      expect.objectContaining({
        clientId: '5',
        subtotal: 2000,
        discountTotal: 0,
        taxTotal: 360,
        total: 2360,
      }),
    );
    expect(quotesRepository.replaceItems).toHaveBeenCalledWith(conn, '3', '42', [
      expect.objectContaining({ lineSubtotal: 2000, lineTax: 360, lineTotal: 2360 }),
    ]);
    expect(createAuditLog).toHaveBeenCalledWith(
      conn,
      expect.objectContaining({ action: 'quote.create', entityId: '42' }),
    );
    expect(conn.commit).toHaveBeenCalled();
  });

  it('refuse un client d’une autre entreprise', async () => {
    findClientById.mockResolvedValue(null);

    await expect(createQuote({ client_id: '5', items: [] }, CONTEXT)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });

    expect(quotesRepository.create).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('refuse un produit introuvable', async () => {
    findClientById.mockResolvedValue(CLIENT);
    findExistingProductIds.mockResolvedValue(new Set());

    await expect(
      createQuote(
        {
          client_id: '5',
          items: [
            {
              product_id: '99',
              description: 'Prestation',
              quantity: 1,
              unit_price: 1000,
              tax_rate: '18',
            },
          ],
        },
        CONTEXT,
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: expect.arrayContaining([expect.objectContaining({ field: 'items.0.product_id' })]),
    });
  });
});

describe('updateQuote', () => {
  it('refuse de modifier un devis non brouillon', async () => {
    quotesRepository.findById.mockResolvedValue({ ...QUOTE, status: 'sent' });

    await expect(updateQuote('42', { notes: 'x' }, CONTEXT)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });

    expect(quotesRepository.updateHeader).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });
});

describe('markQuoteAsSent', () => {
  it('attribue un numéro et fige les instantanés', async () => {
    quotesRepository.findById.mockResolvedValue({
      ...QUOTE,
      items: [{ id: '1', description: 'Prestation' }],
    });
    findSettingsById.mockResolvedValue(COMPANY);
    findClientById.mockResolvedValue(CLIENT);
    nextSequenceValue.mockResolvedValue(1);
    formatDocumentNumber.mockReturnValue('DEV-2026-0001');
    quotesRepository.markSent.mockResolvedValue(1);

    await markQuoteAsSent('42', CONTEXT);

    expect(nextSequenceValue).toHaveBeenCalledWith(conn, '3', 'quote', expect.any(Number));
    expect(quotesRepository.markSent).toHaveBeenCalledWith(
      conn,
      '3',
      '42',
      expect.objectContaining({
        number: 'DEV-2026-0001',
        issueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        clientSnapshot: expect.objectContaining({ name: 'Awa' }),
        issuerSnapshot: expect.objectContaining({ name: 'Alpha' }),
      }),
    );
    expect(conn.commit).toHaveBeenCalled();
  });

  it('refuse un devis sans ligne', async () => {
    quotesRepository.findById.mockResolvedValue({ ...QUOTE, items: [] });

    await expect(markQuoteAsSent('42', CONTEXT)).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
    });
    expect(quotesRepository.markSent).not.toHaveBeenCalled();
  });

  it('refuse un devis déjà envoyé', async () => {
    quotesRepository.findById.mockResolvedValue({ ...QUOTE, status: 'sent', items: [{}] });

    await expect(markQuoteAsSent('42', CONTEXT)).rejects.toMatchObject({ status: 409 });
  });
});

describe('changeQuoteStatus', () => {
  it('accepte un devis envoyé', async () => {
    quotesRepository.findById.mockResolvedValue({ ...QUOTE, status: 'sent' });
    quotesRepository.updateStatus.mockResolvedValue(1);

    await changeQuoteStatus('42', { status: 'accepted' }, CONTEXT);

    expect(quotesRepository.updateStatus).toHaveBeenCalledWith(
      conn,
      '3',
      '42',
      expect.objectContaining({ status: 'accepted', acceptedAt: expect.any(Date) }),
    );
    expect(conn.commit).toHaveBeenCalled();
  });

  it('refuse un devis brouillon', async () => {
    quotesRepository.findById.mockResolvedValue({ ...QUOTE, status: 'draft' });

    await expect(changeQuoteStatus('42', { status: 'refused' }, CONTEXT)).rejects.toMatchObject({
      status: 409,
    });
  });
});
