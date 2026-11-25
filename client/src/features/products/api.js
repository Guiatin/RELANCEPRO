import { api } from '../../lib/http.js';

export async function listProducts(params = {}) {
  const response = await api.get('/products', { params });

  return response.data;
}

export async function getProduct(id) {
  const response = await api.get(`/products/${id}`);

  return response.data.data;
}

export async function createProduct(payload) {
  const response = await api.post('/products', payload);

  return response.data.data;
}

export async function updateProduct(id, payload) {
  const response = await api.patch(`/products/${id}`, payload);

  return response.data.data;
}

export async function deleteProduct(id) {
  await api.delete(`/products/${id}`);
}
