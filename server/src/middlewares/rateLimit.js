import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { rateLimited } from '../utils/errors.js';

const WINDOW_MS = 15 * 60 * 1000;

function handler(req, res, next) {
  next(rateLimited());
}

function baseOptions(overrides = {}) {
  return {
    windowMs: WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    handler,
    ...overrides,
  };
}

export const globalLimiter = rateLimit(
  baseOptions({
    limit: 300,
  }),
);

export const loginLimiter = rateLimit(
  baseOptions({
    limit: env.AUTH_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
  }),
);

export const registerLimiter = rateLimit(
  baseOptions({
    limit: env.AUTH_RATE_LIMIT_MAX,
  }),
);

export const resetLimiter = rateLimit(
  baseOptions({
    limit: env.AUTH_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip ?? 'unknown')}:${String(req.body?.email ?? '')
        .trim()
        .toLowerCase()}`,
  }),
);

export const passwordLimiter = rateLimit(
  baseOptions({
    limit: env.AUTH_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
  }),
);
