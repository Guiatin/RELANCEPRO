import axios from 'axios';
import { readCookie } from './cookies.js';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/reset-password', '/auth/refresh'];

let unauthorizedHandler = null;
let refreshPromise = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

function notifyUnauthorized() {
  if (unauthorizedHandler) {
    unauthorizedHandler();
  }
}

api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase() ?? 'GET';

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCookie('csrf_token');

    if (csrfToken) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('X-CSRF-Token', csrfToken);
      } else {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url ?? '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !isAuthEndpoint &&
      readCookie('csrf_token')
    ) {
      original._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = api.post('/auth/refresh').finally(() => {
            refreshPromise = null;
          });
        }

        await refreshPromise;
        return api(original);
      } catch (refreshError) {
        notifyUnauthorized();
        return Promise.reject(refreshError);
      }
    }

    if (status === 401 && !isAuthEndpoint) {
      notifyUnauthorized();
    }

    return Promise.reject(error);
  },
);
