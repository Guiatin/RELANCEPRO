export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const BCRYPT_ROUNDS = 12;

export const COOKIE_NAMES = {
  access: 'rp_at',
  refresh: 'rp_rt',
  csrf: 'csrf_token',
};

export const REFRESH_COOKIE_PATH = '/api/v1/auth';
export const CSRF_HEADER = 'x-csrf-token';

export const JWT_ISSUER = 'relancepro';
export const JWT_AUDIENCE = 'relancepro-client';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;
