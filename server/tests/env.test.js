import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

const validSource = {
  NODE_ENV: 'test',
  PORT: '5000',
  APP_ORIGIN: 'http://localhost:5173',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'relancepro_dev',
  DB_PASSWORD: 'mot-de-passe-de-test',
  DB_NAME: 'relancepro_dev',
  UPLOAD_DIR: './uploads',
  MAX_UPLOAD_MB: '2',
  JWT_ACCESS_SECRET: 'secret-de-test-suffisamment-long-pour-la-validation',
  COOKIE_SECURE: 'false',
  AUTH_RATE_LIMIT_MAX: '5',
};

const validProductionSource = {
  ...validSource,
  NODE_ENV: 'production',
  APP_ORIGIN: 'https://app.relancepro.example',
  JWT_ACCESS_SECRET: '0123456789abcdef'.repeat(4),
  COOKIE_SECURE: 'true',
};

describe('parseEnv', () => {
  it('convertit les valeurs numériques', () => {
    const env = parseEnv(validSource);

    expect(env.PORT).toBe(5000);
    expect(env.DB_PORT).toBe(3306);
    expect(env.MAX_UPLOAD_MB).toBe(2);
    expect(env.NODE_ENV).toBe('test');
  });

  it('rejette un port invalide', () => {
    expect(() => parseEnv({ ...validSource, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejette une origine invalide', () => {
    expect(() => parseEnv({ ...validSource, APP_ORIGIN: 'pas-une-url' })).toThrow(/APP_ORIGIN/);
  });

  it('signale un champ manquant sans exposer sa valeur', () => {
    expect(() => parseEnv({ ...validSource, DB_PASSWORD: '' })).toThrow(/DB_PASSWORD/);
  });

  it('accepte une configuration de production durcie', () => {
    expect(() => parseEnv(validProductionSource)).not.toThrow();
  });

  it('rejette HTTP en production', () => {
    expect(() =>
      parseEnv({ ...validProductionSource, APP_ORIGIN: 'http://app.relancepro.example' }),
    ).toThrow(/APP_ORIGIN/);
  });

  it('rejette COOKIE_SECURE=false en production', () => {
    expect(() => parseEnv({ ...validProductionSource, COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SECURE/,
    );
  });

  it('rejette un secret JWT d’exemple en production', () => {
    expect(() =>
      parseEnv({
        ...validProductionSource,
        JWT_ACCESS_SECRET: 'change_me_random_string_at_least_32_characters',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejette un secret JWT à faible diversité en production', () => {
    expect(() => parseEnv({ ...validProductionSource, JWT_ACCESS_SECRET: 'a'.repeat(64) })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });
});
