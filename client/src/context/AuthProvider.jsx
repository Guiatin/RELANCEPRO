import { useEffect, useState } from 'react';
import { readCookie } from '../lib/cookies.js';
import { api, setUnauthorizedHandler } from '../lib/http.js';
import { AuthContext } from './auth-context.js';

const ANONYMOUS = {
  status: 'anonymous',
  user: null,
  company: null,
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() =>
    readCookie('csrf_token') ? { status: 'loading', user: null, company: null } : ANONYMOUS,
  );

  useEffect(() => {
    if (session.status !== 'loading') return undefined;

    let active = true;

    api
      .get('/auth/me')
      .then((response) => {
        if (!active) return;

        setSession({
          status: 'authenticated',
          user: response.data.data.user,
          company: response.data.data.company,
        });
      })
      .catch(() => {
        if (active) {
          setSession(ANONYMOUS);
        }
      });

    return () => {
      active = false;
    };
  }, [session.status]);

  useEffect(() => {
    setUnauthorizedHandler(() => setSession(ANONYMOUS));

    return () => setUnauthorizedHandler(null);
  }, []);

  async function login(credentials) {
    const response = await api.post('/auth/login', credentials);

    setSession({
      status: 'authenticated',
      user: response.data.data.user,
      company: response.data.data.company,
    });

    return response.data.data;
  }

  async function register(payload) {
    const response = await api.post('/auth/register', payload);

    setSession({
      status: 'authenticated',
      user: response.data.data.user,
      company: response.data.data.company,
    });

    return response.data.data;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setSession(ANONYMOUS);
    }
  }

  async function refreshUser() {
    const response = await api.get('/auth/me');

    setSession({
      status: 'authenticated',
      user: response.data.data.user,
      company: response.data.data.company,
    });

    return response.data.data;
  }

  const value = {
    ...session,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
