import { timingSafeEqual } from 'node:crypto';
import { COOKIE_NAMES, CSRF_HEADER } from '../config/constants.js';
import { forbidden } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtect(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[COOKIE_NAMES.csrf];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return next(forbidden('Jeton CSRF manquant ou invalide.'));
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
    return next(forbidden('Jeton CSRF manquant ou invalide.'));
  }

  next();
}
