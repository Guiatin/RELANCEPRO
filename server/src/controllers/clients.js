import * as clientsService from '../services/clients.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function context(req) {
  return { user: req.user };
}

export const listClients = asyncHandler(async (req, res) => {
  const { data, total } = await clientsService.listClients(req.query, context(req));

  res.json({
    data,
    meta: {
      page: req.query.page ?? 1,
      limit: req.query.limit ?? 20,
      total,
    },
  });
});

export const getClient = asyncHandler(async (req, res) => {
  const client = await clientsService.getClient(req.params.id, context(req));

  res.json({ data: client });
});

export const createClient = asyncHandler(async (req, res) => {
  const client = await clientsService.createClient(req.body, context(req));

  res.status(201).json({ data: client });
});

export const updateClient = asyncHandler(async (req, res) => {
  const { client } = await clientsService.updateClient(req.params.id, req.body, context(req));

  res.status(200).json({ data: client });
});

export const deleteClient = asyncHandler(async (req, res) => {
  await clientsService.deleteClient(req.params.id, context(req));

  res.status(204).end();
});
