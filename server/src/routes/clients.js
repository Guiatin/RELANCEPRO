import { Router } from 'express';
import * as clientsController from '../controllers/clients.js';
import { requireActiveUser, requireAuth } from '../middlewares/auth.js';
import { csrfProtect } from '../middlewares/csrf.js';
import { validate, validateParams, validateQuery } from '../middlewares/validate.js';
import {
  clientIdParamSchema,
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from '../validators/clients.js';

const router = Router();

router.use(requireAuth, requireActiveUser);

router.get('/', validateQuery(listClientsQuerySchema), clientsController.listClients);
router.post('/', csrfProtect, validate(createClientSchema), clientsController.createClient);
router.get('/:id', validateParams(clientIdParamSchema), clientsController.getClient);
router.patch(
  '/:id',
  csrfProtect,
  validateParams(clientIdParamSchema),
  validate(updateClientSchema),
  clientsController.updateClient,
);
router.delete(
  '/:id',
  csrfProtect,
  validateParams(clientIdParamSchema),
  clientsController.deleteClient,
);

export default router;
