import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/products.js', () => ({
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

import * as productsController from '../src/controllers/products.js';
import * as productsService from '../src/services/products.js';

const USER = { id: '7', companyId: '3' };
const PRODUCT = { id: '42', companyId: '3', type: 'product', name: 'Chaise' };

function createRes() {
  const res = {};

  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.end = vi.fn(() => res);

  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listProducts', () => {
  it('transmet les filtres et le contexte, puis retourne data et meta', async () => {
    productsService.listProducts.mockResolvedValue({ data: [PRODUCT], total: 1 });
    const req = {
      query: { search: 'chaise', type: 'product', active: 'true', page: 2, limit: 10 },
      user: USER,
    };
    const res = createRes();

    await productsController.listProducts(req, res, vi.fn());

    expect(productsService.listProducts).toHaveBeenCalledWith(req.query, { user: USER });
    expect(res.json).toHaveBeenCalledWith({
      data: [PRODUCT],
      meta: { page: 2, limit: 10, total: 1 },
    });
  });

  it('applique les valeurs par défaut de pagination', async () => {
    productsService.listProducts.mockResolvedValue({ data: [], total: 0 });
    const res = createRes();

    await productsController.listProducts({ query: {}, user: USER }, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });
});

describe('getProduct', () => {
  it("utilise l'id validé et le contexte authentifié", async () => {
    productsService.getProduct.mockResolvedValue(PRODUCT);
    const req = { params: { id: '42' }, user: USER };
    const res = createRes();

    await productsController.getProduct(req, res, vi.fn());

    expect(productsService.getProduct).toHaveBeenCalledWith('42', { user: USER });
    expect(res.json).toHaveBeenCalledWith({ data: PRODUCT });
  });
});

describe('createProduct', () => {
  it('transmet le body validé et répond 201', async () => {
    productsService.createProduct.mockResolvedValue(PRODUCT);
    const req = { body: { type: 'product', name: 'Chaise' }, user: USER };
    const res = createRes();

    await productsController.createProduct(req, res, vi.fn());

    expect(productsService.createProduct).toHaveBeenCalledWith(
      { type: 'product', name: 'Chaise' },
      { user: USER },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: PRODUCT });
  });
});

describe('updateProduct', () => {
  it('répond 200 avec le produit quand une valeur a changé', async () => {
    productsService.updateProduct.mockResolvedValue({ product: PRODUCT, updated: true });
    const req = { params: { id: '42' }, body: { name: 'Table' }, user: USER };
    const res = createRes();

    await productsController.updateProduct(req, res, vi.fn());

    expect(productsService.updateProduct).toHaveBeenCalledWith(
      '42',
      { name: 'Table' },
      { user: USER },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: PRODUCT });
  });

  it('répond 200 sans erreur quand aucune valeur ne change', async () => {
    productsService.updateProduct.mockResolvedValue({ product: PRODUCT, updated: false });
    const req = { params: { id: '42' }, body: { name: 'Chaise' }, user: USER };
    const res = createRes();

    await productsController.updateProduct(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: PRODUCT });
  });
});

describe('deleteProduct', () => {
  it('transmet id et contexte puis répond 204', async () => {
    productsService.deleteProduct.mockResolvedValue(undefined);
    const req = { params: { id: '42' }, user: USER };
    const res = createRes();

    await productsController.deleteProduct(req, res, vi.fn());

    expect(productsService.deleteProduct).toHaveBeenCalledWith('42', { user: USER });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});

describe('gestion des erreurs', () => {
  it('transmet les erreurs du service au middleware central', async () => {
    const error = new Error('introuvable');
    productsService.getProduct.mockRejectedValue(error);
    const next = vi.fn();

    await productsController.getProduct({ params: { id: '42' }, user: USER }, createRes(), next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
