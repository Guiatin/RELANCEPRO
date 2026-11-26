import { Router } from 'express';
import * as quotesController from '../controllers/quotes.js';
import { requireActiveUser, requireAuth } from '../middlewares/auth.js';
import { csrfProtect } from '../middlewares/csrf.js';
import { validate, validateParams, validateQuery } from '../middlewares/validate.js';
import {
  createQuoteSchema,
  listQuotesQuerySchema,
  quoteIdParamSchema,
  quoteStatusSchema,
  updateQuoteSchema,
} from '../validators/quotes.js';

const router = Router();

router.use(requireAuth, requireActiveUser);

router.get('/', validateQuery(listQuotesQuerySchema), quotesController.listQuotes);
router.post('/', csrfProtect, validate(createQuoteSchema), quotesController.createQuote);
router.get('/:id/pdf', validateParams(quoteIdParamSchema), quotesController.getQuotePdf);
router.get('/:id', validateParams(quoteIdParamSchema), quotesController.getQuote);
router.patch(
  '/:id',
  csrfProtect,
  validateParams(quoteIdParamSchema),
  validate(updateQuoteSchema),
  quotesController.updateQuote,
);
router.delete(
  '/:id',
  csrfProtect,
  validateParams(quoteIdParamSchema),
  quotesController.deleteQuote,
);
router.post(
  '/:id/mark-sent',
  csrfProtect,
  validateParams(quoteIdParamSchema),
  quotesController.markQuoteAsSent,
);
router.post(
  '/:id/status',
  csrfProtect,
  validateParams(quoteIdParamSchema),
  validate(quoteStatusSchema),
  quotesController.changeQuoteStatus,
);

export default router;
