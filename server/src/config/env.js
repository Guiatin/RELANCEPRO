import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const WEAK_JWT_SECRET_PATTERNS = [
  /change[_-]?me/i,
  /example/i,
  /placeholder/i,
  /your[_-]/i,
  /secret-de-test/i,
  /^development/i,
  /^test/i,
];

const WEAK_JWT_SECRET_VALUES = new Set(['secret', 'password', 'jwt_secret', 'changeme']);

function isWeakJwtSecret(secret) {
  const normalized = secret.trim().toLowerCase();

  return (
    new Set(normalized).size < 8 ||
    WEAK_JWT_SECRET_VALUES.has(normalized) ||
    WEAK_JWT_SECRET_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(5000),
    APP_ORIGIN: z.string().refine(
      (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'URL invalide' },
    ),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().max(65535).default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),
    UPLOAD_DIR: z.string().min(1).default('./uploads'),
    MAX_UPLOAD_MB: z.coerce.number().int().positive().max(20).default(2),
    JWT_ACCESS_SECRET: z
      .string()
      .trim()
      .min(32, 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères'),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(1000).default(5),
  })
  .superRefine((data, context) => {
    if (data.NODE_ENV !== 'production') {
      return;
    }

    if (isWeakJwtSecret(data.JWT_ACCESS_SECRET)) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET doit être une valeur aléatoire dédiée à la production',
      });
    }

    if (!data.COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE doit être true en production',
      });
    }

    if (new URL(data.APP_ORIGIN).protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'APP_ORIGIN doit utiliser HTTPS en production',
      });
    }
  });

export function parseEnv(source) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuration d'environnement invalide : ${fields}`);
  }

  return result.data;
}

export const env = parseEnv(process.env);
