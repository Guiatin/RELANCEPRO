import { describe, expect, it } from 'vitest';
import {
  createQuoteSchema,
  listQuotesQuerySchema,
  parseCreateQuote,
  quoteIdParamSchema,
  updateQuoteSchema,
} from '../src/validators/quotes.js';

const ITEM = {
  description: 'Prestation',
  quantity: '2',
  unit_price: 1000,
  tax_rate: '18',
};

function issues(schema, value) {
  const result = schema.safeParse(value);

  return result.success ? [] : result.error.issues;
}

function fields(schema, value) {
  return issues(schema, value).flatMap((issue) =>
    issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)
      ? issue.keys
      : [issue.path.join('.')],
  );
}

describe('createQuoteSchema', () => {
  it('accepte un devis valide et normalise les décimales', () => {
    const result = createQuoteSchema.safeParse({
      client_id: '1',
      notes: 'Merci',
      items: [ITEM],
    });

    expect(result.success).toBe(true);
    expect(result.data.items[0]).toMatchObject({
      description: 'Prestation',
      quantity: '2.00',
      unit_price: 1000,
      discount_rate: '0.00',
      tax_rate: '18.00',
    });
  });

  it('accepte un brouillon sans ligne', () => {
    expect(createQuoteSchema.safeParse({ client_id: '1', items: [] }).success).toBe(true);
  });

  it('rejette un client manquant ou un champ inconnu', () => {
    expect(fields(createQuoteSchema, { items: [] })).toContain('client_id');
    expect(fields(createQuoteSchema, { client_id: '1', company_id: '9' })).toContain('company_id');
    expect(fields(createQuoteSchema, { client_id: '1', id: '9' })).toContain('id');
  });

  it('rejette les quantités, prix et taux hors bornes', () => {
    expect(
      fields(createQuoteSchema, { client_id: '1', items: [{ ...ITEM, quantity: 0 }] }),
    ).toContain('items.0.quantity');
    expect(
      fields(createQuoteSchema, { client_id: '1', items: [{ ...ITEM, quantity: '1.234' }] }),
    ).toContain('items.0.quantity');
    expect(
      fields(createQuoteSchema, { client_id: '1', items: [{ ...ITEM, unit_price: 12.5 }] }),
    ).toContain('items.0.unit_price');
    expect(
      fields(createQuoteSchema, { client_id: '1', items: [{ ...ITEM, unit_price: '1000' }] }),
    ).toContain('items.0.unit_price');
    expect(
      fields(createQuoteSchema, { client_id: '1', items: [{ ...ITEM, tax_rate: '101' }] }),
    ).toContain('items.0.tax_rate');
    expect(
      fields(createQuoteSchema, { client_id: '1', items: [{ ...ITEM, discount_rate: '101' }] }),
    ).toContain('items.0.discount_rate');
  });

  it('impose un code d’exonération cohérent avec un taux à 0', () => {
    const exemptWithoutCode = { ...ITEM, tax_rate: '0' };
    expect(fields(createQuoteSchema, { client_id: '1', items: [exemptWithoutCode] })).toContain(
      'items.0.tax_exemption_code',
    );

    const otherWithoutReason = {
      ...ITEM,
      tax_rate: '0',
      tax_exemption_code: 'other',
    };
    expect(fields(createQuoteSchema, { client_id: '1', items: [otherWithoutReason] })).toContain(
      'items.0.tax_exemption_reason',
    );

    const reasonWithLegal = {
      ...ITEM,
      tax_rate: '0',
      tax_exemption_code: 'legal',
      tax_exemption_reason: 'Interdit',
    };
    expect(fields(createQuoteSchema, { client_id: '1', items: [reasonWithLegal] })).toContain(
      'items.0.tax_exemption_reason',
    );

    const codeWithTax = { ...ITEM, tax_exemption_code: 'legal' };
    expect(fields(createQuoteSchema, { client_id: '1', items: [codeWithTax] })).toContain(
      'items.0.tax_exemption_code',
    );

    expect(
      createQuoteSchema.safeParse({
        client_id: '1',
        items: [{ ...ITEM, tax_rate: '0', tax_exemption_code: 'legal' }],
      }).success,
    ).toBe(true);

    expect(
      createQuoteSchema.safeParse({
        client_id: '1',
        items: [
          {
            ...ITEM,
            tax_rate: '0',
            tax_exemption_code: 'other',
            tax_exemption_reason: 'Cas particulier',
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('updateQuoteSchema', () => {
  it('accepte une modification partielle', () => {
    expect(updateQuoteSchema.safeParse({ notes: 'Nouvelle note' }).success).toBe(true);
    expect(updateQuoteSchema.safeParse({ items: [] }).success).toBe(true);
  });

  it('rejette une modification vide ou un champ inconnu', () => {
    expect(fields(updateQuoteSchema, {})).toContain('');
    expect(fields(updateQuoteSchema, { company_id: '9' })).toContain('company_id');
  });
});

describe('listQuotesQuerySchema', () => {
  it('accepte des filtres valides', () => {
    expect(
      listQuotesQuerySchema.safeParse({
        status: 'sent',
        client_id: '12',
        reference: 'PO-1',
        from: '2026-01-01',
        to: '2026-12-31',
        page: '2',
        limit: '50',
      }).success,
    ).toBe(true);
  });

  it('rejette un statut ou une date invalide', () => {
    expect(fields(listQuotesQuerySchema, { status: 'paid' })).toContain('status');
    expect(fields(listQuotesQuerySchema, { from: '2026-13-01' })).toContain('from');
    expect(fields(listQuotesQuerySchema, { limit: '500' })).toContain('limit');
  });
});

describe('quoteIdParamSchema', () => {
  it('accepte un identifiant BIGINT positif et rejette les autres', () => {
    expect(quoteIdParamSchema.safeParse({ id: '9007199254740993' }).success).toBe(true);
    expect(quoteIdParamSchema.safeParse({ id: '0' }).success).toBe(false);
    expect(quoteIdParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
  });
});

describe('parseCreateQuote', () => {
  it('lève une erreur 422 détaillée pour un corps invalide', () => {
    expect(() => parseCreateQuote({ items: [] })).toThrowError(
      expect.objectContaining({ status: 422, code: 'VALIDATION_ERROR' }),
    );
  });
});
