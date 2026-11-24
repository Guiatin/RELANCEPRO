import * as productsService from '../services/products.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function context(req) {
  return { user: req.user };
}

export const listProducts = asyncHandler(async (req, res) => {
  const { data, total } = await productsService.listProducts(req.query, context(req));

  res.json({
    data,
    meta: {
      page: req.query.page ?? 1,
      limit: req.query.limit ?? 20,
      total,
    },
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await productsService.getProduct(req.params.id, context(req));

  res.json({ data: product });
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await productsService.createProduct(req.body, context(req));

  res.status(201).json({ data: product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { product } = await productsService.updateProduct(req.params.id, req.body, context(req));

  res.status(200).json({ data: product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  await productsService.deleteProduct(req.params.id, context(req));

  res.status(204).end();
});
