import { pool } from '../config/db.js';
import {
  create as insertClient,
  findAllByCompany,
  findById,
  softDelete,
  update as modifyClient,
} from '../repositories/clients.js';
import { AppError } from '../utils/errors.js';

const CLIENT_FIELDS = {
  name: 'name',
  contact_name: 'contactName',
  email: 'email',
  phone: 'phone',
  whatsapp: 'whatsapp',
  address: 'address',
  city: 'city',
  notes: 'notes',
  is_active: 'isActive',
};

function clientNotFound() {
  return new AppError(404, 'NOT_FOUND', 'Client introuvable.');
}

function tenant(context) {
  return { companyId: context.user.companyId, userId: context.user.id };
}

function toRepositoryData(data) {
  const result = {};

  for (const [apiKey, repositoryKey] of Object.entries(CLIENT_FIELDS)) {
    if (data[apiKey] !== undefined) result[repositoryKey] = data[apiKey];
  }

  return result;
}

export async function listClients(filters, context) {
  return findAllByCompany(pool, tenant(context).companyId, filters);
}

export async function getClient(clientId, context) {
  const client = await findById(pool, tenant(context).companyId, clientId);

  if (!client) throw clientNotFound();

  return client;
}

export async function createClient(data, context) {
  const { companyId, userId } = tenant(context);
  const clientId = await insertClient(pool, companyId, userId, toRepositoryData(data));

  return findById(pool, companyId, clientId);
}

export async function updateClient(clientId, data, context) {
  const { client, updated } = await modifyClient(
    pool,
    tenant(context).companyId,
    clientId,
    toRepositoryData(data),
  );

  if (!client) throw clientNotFound();

  return { client, updated };
}

export async function deleteClient(clientId, context) {
  const deleted = await softDelete(pool, tenant(context).companyId, clientId);

  if (!deleted) throw clientNotFound();
}
