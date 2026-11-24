import { Router } from 'express';
import * as productsController from '../controllers/products.js';
import { requireActiveUser, requireAuth } from '../middlewares/auth.js';
import { csrfProtect } from '../middlewares/csrf.js';
import { validate, validateParams, validateQuery } from '../middlewares/validate.js';
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from '../validators/products.js';

const router = Router();

router.use(requireAuth, requireActiveUser);

router.get('/', validateQuery(listProductsQuerySchema), productsController.listProducts);
router.post('/', csrfProtect, validate(createProductSchema), productsController.createProduct);
router.get('/:id', validateParams(productIdParamSchema), productsController.getProduct);
router.patch(
  '/:id',
  csrfProtect,
  validateParams(productIdParamSchema),
  validate(updateProductSchema),
  productsController.updateProduct,
);
router.delete(
  '/:id',
  csrfProtect,
  validateParams(productIdParamSchema),
  productsController.deleteProduct,
);

export default router;
