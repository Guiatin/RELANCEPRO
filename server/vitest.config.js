import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DB_NAME: 'relancepro_test',
      COOKIE_SECURE: 'false',
      AUTH_RATE_LIMIT_MAX: '1000',
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
