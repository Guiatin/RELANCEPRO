import { env } from '../config/env.js';
import {
  ACCESS_TOKEN_TTL_MS,
  COOKIE_NAMES,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_MS,
} from '../config/constants.js';

function cookieOptions(overrides = {}) {
  return {
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    ...overrides,
  };
}

export function setAccessCookie(res, token) {
  res.cookie(
    COOKIE_NAMES.access,
    token,
    cookieOptions({ httpOnly: true, path: '/', maxAge: ACCESS_TOKEN_TTL_MS }),
  );
}

export function setRefreshCookie(res, token) {
  res.cookie(
    COOKIE_NAMES.refresh,
    token,
    cookieOptions({
      httpOnly: true,
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_MS,
    }),
  );
}

export function setCsrfCookie(res, token) {
  res.cookie(
    COOKIE_NAMES.csrf,
    token,
    cookieOptions({ httpOnly: false, path: '/', maxAge: REFRESH_TOKEN_TTL_MS }),
  );
}

export function clearAuthCookies(res) {
  res.clearCookie(COOKIE_NAMES.access, cookieOptions({ httpOnly: true, path: '/' }));
  res.clearCookie(
    COOKIE_NAMES.refresh,
    cookieOptions({ httpOnly: true, path: REFRESH_COOKIE_PATH }),
  );
  res.clearCookie(COOKIE_NAMES.csrf, cookieOptions({ httpOnly: false, path: '/' }));
}

export function readRefreshToken(req) {
  return req.cookies?.[COOKIE_NAMES.refresh] ?? null;
}

export function readAccessToken(req) {
  return req.cookies?.[COOKIE_NAMES.access] ?? null;
}
