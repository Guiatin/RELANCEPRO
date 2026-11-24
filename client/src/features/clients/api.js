import { api } from '../../lib/http.js';

export async function listClients(params = {}) {
  const response = await api.get('/clients', { params });

  return response.data;
}

export async function getClient(id) {
  const response = await api.get(`/clients/${id}`);

  return response.data.data;
}

export async function createClient(payload) {
  const response = await api.post('/clients', payload);

  return response.data.data;
}

export async function updateClient(id, payload) {
  const response = await api.patch(`/clients/${id}`, payload);

  return response.data.data;
}

export async function deleteClient(id) {
  await api.delete(`/clients/${id}`);
}
