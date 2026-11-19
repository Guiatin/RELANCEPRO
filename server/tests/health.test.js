import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';

afterAll(async () => {
  await pool.end();
});

describe('API v1', () => {
  it('expose un health check connecté à la base', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.db).toBe('up');
    expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('renvoie une erreur normalisée pour une route inconnue', async () => {
    const response = await request(app).get('/api/v1/route-inconnue');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('Ressource introuvable.');
  });
});
