import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/clients.js', () => ({
  listClients: vi.fn(),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));

import * as clientsController from '../src/controllers/clients.js';
import * as clientsService from '../src/services/clients.js';

const USER = { id: '7', companyId: '3' };
const CLIENT = { id: '42', companyId: '3', name: 'Awa' };

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

describe('listClients', () => {
  it('transmet les filtres et le contexte, puis retourne data et meta', async () => {
    clientsService.listClients.mockResolvedValue({ data: [CLIENT], total: 1 });
    const req = { query: { search: 'awa', active: 'true', page: 2, limit: 10 }, user: USER };
    const res = createRes();

    await clientsController.listClients(req, res, vi.fn());

    expect(clientsService.listClients).toHaveBeenCalledWith(req.query, { user: USER });
    expect(res.json).toHaveBeenCalledWith({
      data: [CLIENT],
      meta: { page: 2, limit: 10, total: 1 },
    });
  });

  it('applique les valeurs par défaut de pagination', async () => {
    clientsService.listClients.mockResolvedValue({ data: [], total: 0 });
    const res = createRes();

    await clientsController.listClients({ query: {}, user: USER }, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  });
});

describe('getClient', () => {
  it("utilise l'id validé et le contexte authentifié", async () => {
    clientsService.getClient.mockResolvedValue(CLIENT);
    const req = { params: { id: '42' }, user: USER };
    const res = createRes();

    await clientsController.getClient(req, res, vi.fn());

    expect(clientsService.getClient).toHaveBeenCalledWith('42', { user: USER });
    expect(res.json).toHaveBeenCalledWith({ data: CLIENT });
  });
});

describe('createClient', () => {
  it('transmet le body validé et répond 201', async () => {
    clientsService.createClient.mockResolvedValue(CLIENT);
    const req = { body: { name: 'Awa' }, user: USER };
    const res = createRes();

    await clientsController.createClient(req, res, vi.fn());

    expect(clientsService.createClient).toHaveBeenCalledWith({ name: 'Awa' }, { user: USER });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: CLIENT });
  });
});

describe('updateClient', () => {
  it('répond 200 avec le client quand une valeur a changé', async () => {
    clientsService.updateClient.mockResolvedValue({ client: CLIENT, updated: true });
    const req = { params: { id: '42' }, body: { city: 'Bobo' }, user: USER };
    const res = createRes();

    await clientsController.updateClient(req, res, vi.fn());

    expect(clientsService.updateClient).toHaveBeenCalledWith(
      '42',
      { city: 'Bobo' },
      { user: USER },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: CLIENT });
  });

  it('répond 200 sans erreur quand aucune valeur ne change', async () => {
    clientsService.updateClient.mockResolvedValue({ client: CLIENT, updated: false });
    const req = { params: { id: '42' }, body: { name: 'Awa' }, user: USER };
    const res = createRes();

    await clientsController.updateClient(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: CLIENT });
  });
});

describe('deleteClient', () => {
  it('transmet id et contexte puis répond 204', async () => {
    clientsService.deleteClient.mockResolvedValue(undefined);
    const req = { params: { id: '42' }, user: USER };
    const res = createRes();

    await clientsController.deleteClient(req, res, vi.fn());

    expect(clientsService.deleteClient).toHaveBeenCalledWith('42', { user: USER });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});

describe('gestion des erreurs', () => {
  it('transmet les erreurs du service au middleware central', async () => {
    const error = new Error('introuvable');
    clientsService.getClient.mockRejectedValue(error);
    const next = vi.fn();

    await clientsController.getClient({ params: { id: '42' }, user: USER }, createRes(), next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
