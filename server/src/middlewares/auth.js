import { readAccessToken } from '../utils/authCookies.js';
import { forbidden, unauthenticated } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pool } from '../config/db.js';
import { findActiveUserForSession } from '../repositories/users.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = readAccessToken(req);

  if (!token) {
    throw unauthenticated();
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    throw unauthenticated('Session expirée ou invalide.');
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.cid !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.sid !== 'string' ||
    !/^\d+$/.test(payload.sid)
  ) {
    throw unauthenticated('Session invalide.');
  }

  const user = await findActiveUserForSession(pool, {
    userId: payload.sub,
    companyId: payload.cid,
    sessionId: payload.sid,
  });

  if (!user) {
    throw unauthenticated('Session expirée ou invalide.');
  }

  req.auth = {
    userId: payload.sub,
    companyId: payload.cid,
    role: payload.role,
    jti: typeof payload.jti === 'string' ? payload.jti : '',
    sessionId: payload.sid,
  };

  req.user = user;

  next();
});

export const requireActiveUser = (req, res, next) => {
  if (!req.user) {
    return next(unauthenticated('Session expirée ou invalide.'));
  }

  next();
};

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return next(forbidden());
    }

    next();
  };
}
