import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../config/constants.js';

export function signAccessToken({ userId, companyId, role }) {
  return jwt.sign(
    {
      sub: String(userId),
      cid: String(companyId),
      role: String(role),
      jti: randomUUID(),
    },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}
