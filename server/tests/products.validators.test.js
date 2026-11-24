import { describe, expect, it } from 'vitest';
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from '../src/validators/products.js';

function expectValid(schema, value) {
  const result = schema.safeParse(value);

  expect(result.success).toBe(true);

  return result.data;
}

function expectInvalid(schema, value) {
  expect(schema.safeParse(value).success).toBe(false);
}

describe('createProductSchema', () => {
  it('accepte un produit minimal', () => {
    expectValid(createProductSchema, { type: 'product', name: 'Chaise' });
  });

  it('accepte tous les champs facultatifs valides', () => {
    expectValid(createProductSchema, {
      type: 'service',
      name: 'Nettoyage',
      description: 'Prestation de nettoyage',
      unit: 'heure',
      unit_price: '1500',
      tax_rate: '18.00',
      is_active: false,
    });
  });

  it('accepte une description et une unité nulles', () => {
    expectValid(createProductSchema, {
      type: 'product',
      name: 'Chaise',
      description: null,
      unit: null,
    });
  });

  it('nettoie les espaces du nom et de l’unité', () => {
    const data = expectValid(createProductSchema, {
      type: 'product',
      name: '  Chaise  ',
      unit: '  pièce  ',
    });

    expect(data.name).toBe('Chaise');
    expect(data.unit).toBe('pièce');
  });

  it('refuse un type absent ou invalide', () => {
    expectInvalid(createProductSchema, { name: 'Chaise' });
    expectInvalid(createProductSchema, { type: 'other', name: 'Chaise' });
    expectInvalid(createProductSchema, { type: 'PRODUCT', name: 'Chaise' });
  });

  it('refuse un nom absent, vide ou composé d’espaces', () => {
    expectInvalid(createProductSchema, { type: 'product' });
    expectInvalid(createProductSchema, { type: 'product', name: '' });
    expectInvalid(createProductSchema, { type: 'product', name: '   ' });
  });

  it('refuse un nom de plus de 120 caractères', () => {
    expectInvalid(createProductSchema, { type: 'product', name: 'a'.repeat(121) });
    expectValid(createProductSchema, { type: 'product', name: 'a'.repeat(120) });
  });

  it('refuse une description non textuelle', () => {
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', description: 12 });
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', description: true });
  });

  it('refuse une unité non textuelle ou de plus de 20 caractères', () => {
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', unit: 12 });
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', unit: 'a'.repeat(21) });
    expectValid(createProductSchema, { type: 'product', name: 'Chaise', unit: 'a'.repeat(20) });
  });

  it('accepte les prix BIGINT UNSIGNED valides', () => {
    expectValid(createProductSchema, { type: 'product', name: 'Chaise', unit_price: '0' });
    expectValid(createProductSchema, { type: 'product', name: 'Chaise', unit_price: '1500' });
    expectValid(createProductSchema, {
      type: 'product',
      name: 'Chaise',
      unit_price: '18446744073709551615',
    });
  });

  it('refuse les prix invalides', () => {
    const invalidPrices = [1500, '18446744073709551616', '-1', '1.5', 'abc', '', '007', null];

    for (const unitPrice of invalidPrices) {
      expectInvalid(createProductSchema, {
        type: 'product',
        name: 'Chaise',
        unit_price: unitPrice,
      });
    }
  });

  it('accepte les taux de TVA valides et les conserve en chaînes', () => {
    const zero = expectValid(createProductSchema, {
      type: 'product',
      name: 'Chaise',
      tax_rate: 0,
    });
    expect(zero.tax_rate).toBe('0');

    const decimal = expectValid(createProductSchema, {
      type: 'product',
      name: 'Chaise',
      tax_rate: 18.1,
    });
    expect(decimal.tax_rate).toBe('18.1');

    expectValid(createProductSchema, {
      type: 'product',
      name: 'Chaise',
      tax_rate: '100.00',
    });
  });

  it('refuse les taux de TVA invalides', () => {
    const invalidRates = [-1, 100.01, 18.123, '1e1', 'abc', '', null, Infinity, NaN];

    for (const taxRate of invalidRates) {
      expectInvalid(createProductSchema, {
        type: 'product',
        name: 'Chaise',
        tax_rate: taxRate,
      });
    }
  });

  it('refuse un is_active non booléen', () => {
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', is_active: 'true' });
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', is_active: 1 });
  });

  it('refuse les propriétés inconnues et les champs réservés', () => {
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', company_id: '1' });
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', created_by: '1' });
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', id: '1' });
    expectInvalid(createProductSchema, { type: 'product', name: 'Chaise', inconnu: true });
  });
});

describe('updateProductSchema', () => {
  it('accepte une modification partielle', () => {
    expectValid(updateProductSchema, { name: 'Table' });
    expectValid(updateProductSchema, { unit_price: '2000' });
    expectValid(updateProductSchema, { is_active: false });
  });

  it('accepte tous les champs modifiables', () => {
    expectValid(updateProductSchema, {
      type: 'service',
      name: 'Nettoyage',
      description: 'Prestation',
      unit: 'heure',
      unit_price: '1500',
      tax_rate: '18.00',
      is_active: true,
    });
  });

  it('refuse un objet vide', () => {
    expectInvalid(updateProductSchema, {});
  });

  it('refuse un nom vide', () => {
    expectInvalid(updateProductSchema, { name: '' });
    expectInvalid(updateProductSchema, { name: '   ' });
  });

  it('refuse un type invalide', () => {
    expectInvalid(updateProductSchema, { type: 'other' });
  });

  it('refuse un prix ou un taux invalide', () => {
    expectInvalid(updateProductSchema, { unit_price: '1.5' });
    expectInvalid(updateProductSchema, { tax_rate: 18.123 });
  });

  it('refuse les propriétés inconnues et les champs réservés', () => {
    expectInvalid(updateProductSchema, { company_id: '1' });
    expectInvalid(updateProductSchema, { created_by: '1' });
    expectInvalid(updateProductSchema, { id: '1' });
    expectInvalid(updateProductSchema, { inconnu: true });
  });
});

describe('listProductsQuerySchema', () => {
  it('accepte une query vide', () => {
    expectValid(listProductsQuerySchema, {});
  });

  it('accepte les filtres valides et convertit page/limit en nombres', () => {
    const data = expectValid(listProductsQuerySchema, {
      search: 'chaise',
      type: 'product',
      active: 'true',
      page: '2',
      limit: '100',
    });

    expect(data).toEqual({
      search: 'chaise',
      type: 'product',
      active: 'true',
      page: 2,
      limit: 100,
    });
  });

  it('accepte type service et active false', () => {
    expectValid(listProductsQuerySchema, { type: 'service', active: 'false' });
  });

  it('refuse un type invalide', () => {
    expectInvalid(listProductsQuerySchema, { type: 'other' });
    expectInvalid(listProductsQuerySchema, { type: '' });
    expectInvalid(listProductsQuerySchema, { type: true });
  });

  it('refuse un format de active autre que true/false', () => {
    expectInvalid(listProductsQuerySchema, { active: '1' });
    expectInvalid(listProductsQuerySchema, { active: true });
    expectInvalid(listProductsQuerySchema, { active: '' });
  });

  it('refuse une page invalide', () => {
    expectInvalid(listProductsQuerySchema, { page: '0' });
    expectInvalid(listProductsQuerySchema, { page: '-1' });
    expectInvalid(listProductsQuerySchema, { page: 'abc' });
    expectInvalid(listProductsQuerySchema, { page: '1.5' });
  });

  it('refuse une limite invalide', () => {
    expectInvalid(listProductsQuerySchema, { limit: '0' });
    expectInvalid(listProductsQuerySchema, { limit: '101' });
    expectInvalid(listProductsQuerySchema, { limit: 'abc' });
    expectValid(listProductsQuerySchema, { limit: '1' });
  });

  it('refuse une recherche de plus de 190 caractères', () => {
    expectInvalid(listProductsQuerySchema, { search: 'a'.repeat(191) });
    expectValid(listProductsQuerySchema, { search: 'a'.repeat(190) });
  });

  it('refuse les paramètres inconnus, dont company_id', () => {
    expectInvalid(listProductsQuerySchema, { company_id: '1' });
    expectInvalid(listProductsQuerySchema, { inconnu: true });
  });
});

describe('productIdParamSchema', () => {
  it('accepte un identifiant numérique positif et le conserve en chaîne', () => {
    const data = expectValid(productIdParamSchema, { id: '42' });

    expect(data.id).toBe('42');
    expect(typeof data.id).toBe('string');
  });

  it('accepte la borne maximale BIGINT UNSIGNED', () => {
    expectValid(productIdParamSchema, { id: '18446744073709551615' });
  });

  it('refuse zéro et les zéros initiaux', () => {
    expectInvalid(productIdParamSchema, { id: '0' });
    expectInvalid(productIdParamSchema, { id: '007' });
  });

  it('refuse les identifiants non numériques', () => {
    expectInvalid(productIdParamSchema, { id: 'abc' });
    expectInvalid(productIdParamSchema, { id: '-1' });
    expectInvalid(productIdParamSchema, { id: '' });
    expectInvalid(productIdParamSchema, { id: ' 42 ' });
  });

  it('refuse un identifiant fourni en Number', () => {
    expectInvalid(productIdParamSchema, { id: 42 });
  });

  it('refuse un identifiant dépassant BIGINT UNSIGNED', () => {
    expectInvalid(productIdParamSchema, { id: '18446744073709551616' });
    expectInvalid(productIdParamSchema, { id: '123456789012345678901' });
  });

  it('refuse les propriétés inconnues', () => {
    expectInvalid(productIdParamSchema, { id: '42', company_id: '1' });
  });
});
