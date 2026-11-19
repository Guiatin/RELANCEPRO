import { readAccessToken } from '../utils/authCookies.js';
import { forbidden, unauthenticated } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pool } from '../config/db.js';
import { findActiveUser } from '../repositories/users.js';

export function requireAuth(req, res, next) {
  const token = readAccessToken(req);

  if (!token) {
    return next(unauthenticated());
  }

  try {
    const payload = verifyAccessToken(token);

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.cid !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return next(unauthenticated('Session invalide.'));
    }

    req.auth = {
      userId: payload.sub,
      companyId: payload.cid,
      role: payload.role,
      jti: typeof payload.jti === 'string' ? payload.jti : '',
    };

    next();
  } catch {
    next(unauthenticated('Session expirée ou invalide.'));
  }
}

export const requireActiveUser = asyncHandler(async (req, res, next) => {
  const user = await findActiveUser(pool, {
    userId: req.auth.userId,
    companyId: req.auth.companyId,
  });

  if (!user) {
    throw unauthenticated('Session expirée ou invalide.');
  }

  req.user = user;
  next();
});

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return next(forbidden());
    }

    next();
  };
}
