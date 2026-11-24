import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/db.js', () => ({ pool: { name: 'pool' } }));
vi.mock('../src/repositories/products.js', () => ({
  findAllByCompany: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

import { pool } from '../src/config/db.js';
import * as productsRepository from '../src/repositories/products.js';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../src/services/products.js';

const CONTEXT = { user: { id: '7', companyId: '3' } };
const PRODUCT = {
  id: '42',
  companyId: '3',
  type: 'product',
  name: 'Chaise',
  description: null,
  unit: null,
  unitPrice: '1500',
  taxRate: '18.00',
  isActive: true,
};

function expectValidationError(promise, field) {
  return expect(promise).rejects.toMatchObject({
    status: 422,
    code: 'VALIDATION_ERROR',
    details: expect.arrayContaining([expect.objectContaining({ field })]),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listProducts', () => {
  it('transmet les filtres et le companyId du contexte', async () => {
    const result = { data: [PRODUCT], total: 1 };
    productsRepository.findAllByCompany.mockResolvedValue(result);

    const filters = { search: 'chaise', type: 'product', active: 'true' };

    expect(await listProducts(filters, CONTEXT)).toBe(result);
    expect(productsRepository.findAllByCompany).toHaveBeenCalledWith(pool, '3', filters);
  });
});

describe('getProduct', () => {
  it('retourne le produit avec son identifiant en chaîne', async () => {
    const bigId = '9007199254740993';
    productsRepository.findById.mockResolvedValue({ ...PRODUCT, id: bigId });

    const product = await getProduct(bigId, CONTEXT);

    expect(productsRepository.findById).toHaveBeenCalledWith(pool, '3', bigId);
    expect(product.id).toBe(bigId);
    expect(typeof product.id).toBe('string');
  });

  it('retourne 404 si le produit est inexistant ou inaccessible', async () => {
    productsRepository.findById.mockResolvedValue(null);

    await expect(getProduct('42', CONTEXT)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('createProduct', () => {
  it('valide et transmet les champs au repository', async () => {
    productsRepository.create.mockResolvedValue('42');
    productsRepository.findById.mockResolvedValue(PRODUCT);

    const result = await createProduct(
      {
        type: 'product',
        name: '  Chaise  ',
        description: 'Bois',
        unit: ' pièce ',
        unit_price: '1500',
        tax_rate: '18',
        is_active: true,
      },
      CONTEXT,
    );

    expect(productsRepository.create).toHaveBeenCalledWith(pool, '3', {
      type: 'product',
      name: 'Chaise',
      description: 'Bois',
      unit: 'pièce',
      unitPrice: '1500',
      taxRate: '18',
      isActive: true,
    });
    expect(productsRepository.findById).toHaveBeenCalledWith(pool, '3', '42');
    expect(result).toBe(PRODUCT);
  });

  it('omet les champs optionnels pour laisser les défauts SQL', async () => {
    productsRepository.create.mockResolvedValue('42');
    productsRepository.findById.mockResolvedValue(PRODUCT);

    await createProduct({ type: 'service', name: 'Nettoyage' }, CONTEXT);

    expect(productsRepository.create).toHaveBeenCalledWith(pool, '3', {
      type: 'service',
      name: 'Nettoyage',
    });
  });

  it('rejette les champs inconnus, id et company_id', async () => {
    await expectValidationError(
      createProduct({ type: 'product', name: 'X', company_id: '9' }, CONTEXT),
      'company_id',
    );
    await expectValidationError(
      createProduct({ type: 'product', name: 'X', id: '1' }, CONTEXT),
      'id',
    );
    await expectValidationError(
      createProduct({ type: 'product', name: 'X', stock: 4 }, CONTEXT),
      'stock',
    );

    expect(productsRepository.create).not.toHaveBeenCalled();
  });

  it('rejette un type manquant ou invalide', async () => {
    await expectValidationError(createProduct({ name: 'X' }, CONTEXT), 'type');
    await expectValidationError(createProduct({ type: 'other', name: 'X' }, CONTEXT), 'type');
  });

  it('rejette un nom manquant, vide ou trop long', async () => {
    await expectValidationError(createProduct({ type: 'product' }, CONTEXT), 'name');
    await expectValidationError(createProduct({ type: 'product', name: '   ' }, CONTEXT), 'name');
    await expectValidationError(
      createProduct({ type: 'product', name: 'a'.repeat(121) }, CONTEXT),
      'name',
    );
  });

  it('accepte la borne maximale BIGINT UNSIGNED', async () => {
    productsRepository.create.mockResolvedValue('42');
    productsRepository.findById.mockResolvedValue(PRODUCT);

    await createProduct(
      { type: 'product', name: 'Max', unit_price: '18446744073709551615' },
      CONTEXT,
    );

    expect(productsRepository.create).toHaveBeenCalledWith(
      pool,
      '3',
      expect.objectContaining({ unitPrice: '18446744073709551615' }),
    );
  });

  it('refuse un prix hors bornes ou mal formé', async () => {
    const invalidPrices = ['18446744073709551616', '-1', '1.5', 'abc', '', null];

    for (const unitPrice of invalidPrices) {
      await expectValidationError(
        createProduct({ type: 'product', name: 'X', unit_price: unitPrice }, CONTEXT),
        'unit_price',
      );
    }

    await expectValidationError(
      createProduct(
        { type: 'product', name: 'X', unit_price: Number.MAX_SAFE_INTEGER + 1 },
        CONTEXT,
      ),
      'unit_price',
    );
  });

  it('conserve un grand prix fourni en chaîne sans conversion Number', async () => {
    productsRepository.create.mockResolvedValue('42');
    productsRepository.findById.mockResolvedValue(PRODUCT);

    await createProduct({ type: 'product', name: 'X', unit_price: '9007199254740993' }, CONTEXT);

    expect(productsRepository.create).toHaveBeenCalledWith(
      pool,
      '3',
      expect.objectContaining({ unitPrice: '9007199254740993' }),
    );
  });

  it('accepte les taux de TVA valides', async () => {
    productsRepository.create.mockResolvedValue('42');
    productsRepository.findById.mockResolvedValue(PRODUCT);

    await createProduct({ type: 'product', name: 'X', tax_rate: '100.00' }, CONTEXT);
    expect(productsRepository.create).toHaveBeenLastCalledWith(
      pool,
      '3',
      expect.objectContaining({ taxRate: '100.00' }),
    );

    await createProduct({ type: 'product', name: 'X', tax_rate: 18.1 }, CONTEXT);
    expect(productsRepository.create).toHaveBeenLastCalledWith(
      pool,
      '3',
      expect.objectContaining({ taxRate: '18.1' }),
    );

    await createProduct({ type: 'product', name: 'X', tax_rate: 0 }, CONTEXT);
    expect(productsRepository.create).toHaveBeenLastCalledWith(
      pool,
      '3',
      expect.objectContaining({ taxRate: '0' }),
    );
  });

  it('refuse les taux de TVA hors bornes ou avec trop de décimales', async () => {
    const invalidRates = [-1, 100.01, 18.123, '1e1', 'abc', null];

    for (const taxRate of invalidRates) {
      await expectValidationError(
        createProduct({ type: 'product', name: 'X', tax_rate: taxRate }, CONTEXT),
        'tax_rate',
      );
    }
  });

  it('refuse un statut non booléen', async () => {
    await expectValidationError(
      createProduct({ type: 'product', name: 'X', is_active: 'true' }, CONTEXT),
      'is_active',
    );
  });

  it('refuse des données non objets', async () => {
    await expectValidationError(createProduct(null, CONTEXT), '');
    await expectValidationError(createProduct([], CONTEXT), '');
  });
});

describe('updateProduct', () => {
  it('transmet la mise à jour et retourne le produit modifié', async () => {
    const updatedProduct = { ...PRODUCT, name: 'Table' };
    productsRepository.update.mockResolvedValue({ product: updatedProduct, updated: true });

    const result = await updateProduct('42', { name: ' Table ' }, CONTEXT);

    expect(productsRepository.update).toHaveBeenCalledWith(pool, '3', '42', { name: 'Table' });
    expect(result).toEqual({ product: updatedProduct, updated: true });
  });

  it('ne produit pas d’erreur 409 pour un no-op', async () => {
    productsRepository.update.mockResolvedValue({ product: PRODUCT, updated: false });

    const result = await updateProduct('42', { name: 'Chaise' }, CONTEXT);

    expect(result).toEqual({ product: PRODUCT, updated: false });
  });

  it('accepte une mise à jour vide et transmet un no-op', async () => {
    productsRepository.update.mockResolvedValue({ product: PRODUCT, updated: false });

    expect(await updateProduct('42', {}, CONTEXT)).toEqual({
      product: PRODUCT,
      updated: false,
    });
    expect(productsRepository.update).toHaveBeenCalledWith(pool, '3', '42', {});
  });

  it('retourne 404 si le produit est inexistant ou inaccessible', async () => {
    productsRepository.update.mockResolvedValue({ product: null, updated: false });

    await expect(updateProduct('42', { name: 'Table' }, CONTEXT)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('rejette les champs inconnus en modification', async () => {
    await expectValidationError(updateProduct('42', { company_id: '9' }, CONTEXT), 'company_id');
    await expectValidationError(updateProduct('42', { id: '1' }, CONTEXT), 'id');
  });

  it('conserve l’identifiant BIGINT en chaîne', async () => {
    const bigId = '9007199254740993';
    productsRepository.update.mockResolvedValue({ product: PRODUCT, updated: true });

    await updateProduct(bigId, { name: 'Table' }, CONTEXT);

    expect(productsRepository.update).toHaveBeenCalledWith(pool, '3', bigId, {
      name: 'Table',
    });
  });
});

describe('deleteProduct', () => {
  it('supprime le produit et retourne undefined', async () => {
    productsRepository.softDelete.mockResolvedValue(true);

    await expect(deleteProduct('42', CONTEXT)).resolves.toBeUndefined();
    expect(productsRepository.softDelete).toHaveBeenCalledWith(pool, '3', '42');
  });

  it('retourne 404 si le produit est inexistant ou inaccessible', async () => {
    productsRepository.softDelete.mockResolvedValue(false);

    await expect(deleteProduct('42', CONTEXT)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});
