import pino from 'pino';
import { env } from '../config/env.js';

const level = env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug';

export const logger = pino({
  level,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.password_hash',
      '*.recovery_code',
      '*.recoveryCode',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
});
