import { api } from '../../lib/http.js';

export async function listQuotes(params = {}) {
  const response = await api.get('/quotes', { params });

  return response.data;
}

export async function getQuote(id) {
  const response = await api.get(`/quotes/${id}`);

  return response.data.data;
}

export async function createQuote(payload) {
  const response = await api.post('/quotes', payload);

  return response.data.data;
}

export async function updateQuote(id, payload) {
  const response = await api.patch(`/quotes/${id}`, payload);

  return response.data.data;
}

export async function deleteQuote(id) {
  await api.delete(`/quotes/${id}`);
}

export async function markQuoteSent(id) {
  const response = await api.post(`/quotes/${id}/mark-sent`);

  return response.data.data;
}

export async function changeQuoteStatus(id, status) {
  const response = await api.post(`/quotes/${id}/status`, { status });

  return response.data.data;
}
