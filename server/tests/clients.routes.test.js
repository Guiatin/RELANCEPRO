import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../src/db/migrate.js';

const BASE = '/api/v1/clients';
const PASSWORD = 'MotDePasse!42';

function cookieValue(response, name) {
  const cookies = response.headers['set-cookie'] ?? [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));

  return cookie ? cookie.slice(name.length + 1).split(';')[0] : null;
}

async function register({ email, company }) {
  const agent = request.agent(app);
  const response = await agent.post('/api/v1/auth/register').send({
    company_name: company,
    full_name: 'Test User',
    email,
    password: PASSWORD,
  });

  return { agent, response, csrf: cookieValue(response, 'csrf_token') };
}

function createClient(agent, csrf, body) {
  return agent.post(BASE).set('X-CSRF-Token', csrf).send(body);
}

async function cleanDatabase() {
  await pool.query('UPDATE sessions SET replaced_by_id = NULL');
  await pool.query('DELETE FROM clients');
  await pool.query('DELETE FROM audit_logs');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM recovery_codes');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM companies');
}

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await pool.end();
});

describe('CRUD clients', () => {
  it('crée, liste, lit, modifie puis supprime un client', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });

    const created = await createClient(agent, csrf, {
      name: 'Awa Traoré',
      email: 'awa@example.com',
      phone: '+22670000000',
      city: 'Ouagadougou',
    });

    expect(created.status).toBe(201);
    expect(typeof created.body.data.id).toBe('string');
    expect(created.body.data.id).toMatch(/^\d+$/);
    expect(created.body.data).toMatchObject({
      name: 'Awa Traoré',
      city: 'Ouagadougou',
      isActive: true,
    });

    const id = created.body.data.id;

    const list = await agent.get(BASE);
    expect(list.status).toBe(200);
    expect(list.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(id);

    const detail = await agent.get(`${BASE}/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.email).toBe('awa@example.com');

    const updated = await agent
      .patch(`${BASE}/${id}`)
      .set('X-CSRF-Token', csrf)
      .send({ city: 'Bobo-Dioulasso', is_active: false });

    expect(updated.status).toBe(200);
    expect(updated.body.data.city).toBe('Bobo-Dioulasso');
    expect(updated.body.data.isActive).toBe(false);

    const removed = await agent.delete(`${BASE}/${id}`).set('X-CSRF-Token', csrf);
    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');

    expect((await agent.get(`${BASE}/${id}`)).status).toBe(404);
    expect((await agent.get(BASE)).body.meta.total).toBe(0);
  });

  it('filtre par recherche et statut, et pagine', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });

    await createClient(agent, csrf, { name: 'Awa' });
    await createClient(agent, csrf, { name: 'Awa Deux' });
    await createClient(agent, csrf, { name: 'Binta', is_active: false });

    const search = await agent.get(`${BASE}?search=awa`);
    expect(search.status).toBe(200);
    expect(search.body.meta.total).toBe(2);

    const active = await agent.get(`${BASE}?active=true`);
    expect(active.status).toBe(200);
    expect(active.body.meta.total).toBe(2);

    const inactive = await agent.get(`${BASE}?active=false`);
    expect(inactive.status).toBe(200);
    expect(inactive.body.meta.total).toBe(1);

    const page = await agent.get(`${BASE}?page=2&limit=2`);
    expect(page.status).toBe(200);
    expect(page.body.meta).toEqual({ page: 2, limit: 2, total: 3 });
    expect(page.body.data).toHaveLength(1);
    expect(page.body.data[0].name).toBe('Binta');
  });

  it('renvoie 404 pour un client inexistant', async () => {
    const { agent } = await register({ email: 'a@example.com', company: 'Alpha' });

    const response = await agent.get(`${BASE}/999999`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Authentification', () => {
  it("refuse l'accès sans authentification", async () => {
    const responses = [
      await request(app).get(BASE),
      await request(app).get(`${BASE}/1`),
      await request(app).post(BASE).send({ name: 'Awa' }),
      await request(app).patch(`${BASE}/1`).send({ name: 'Awa' }),
      await request(app).delete(`${BASE}/1`),
    ];

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });
});

describe('Validation', () => {
  it('rejette les corps invalides et le mass assignment', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });

    const emptyName = await createClient(agent, csrf, { name: '   ' });
    expect(emptyName.status).toBe(422);
    expect(emptyName.body.error.code).toBe('VALIDATION_ERROR');

    const massAssignment = await createClient(agent, csrf, {
      name: 'Awa',
      company_id: '42',
      user_id: '7',
    });
    expect(massAssignment.status).toBe(422);
    expect(massAssignment.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejette les identifiants et query strings invalides', async () => {
    const { agent } = await register({ email: 'a@example.com', company: 'Alpha' });

    const badId = await agent.get(`${BASE}/abc`);
    expect(badId.status).toBe(422);

    const zeroId = await agent.get(`${BASE}/0`);
    expect(zeroId.status).toBe(422);

    const badLimit = await agent.get(`${BASE}?limit=500`);
    expect(badLimit.status).toBe(422);

    const badActive = await agent.get(`${BASE}?active=oui`);
    expect(badActive.status).toBe(422);
  });

  it('rejette une modification vide', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const created = await createClient(agent, csrf, { name: 'Awa' });

    const response = await agent
      .patch(`${BASE}/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Protection CSRF', () => {
  it('refuse les écritures sans jeton CSRF valide', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const created = await createClient(agent, csrf, { name: 'Awa' });
    const id = created.body.data.id;

    const noHeader = await agent.post(BASE).send({ name: 'Sans jeton' });
    expect(noHeader.status).toBe(403);
    expect(noHeader.body.error.code).toBe('FORBIDDEN');

    const badPatch = await agent
      .patch(`${BASE}/${id}`)
      .set('X-CSRF-Token', 'mauvais-jeton')
      .send({ name: 'Modifié' });
    expect(badPatch.status).toBe(403);

    const badDelete = await agent.delete(`${BASE}/${id}`).set('X-CSRF-Token', 'mauvais-jeton');
    expect(badDelete.status).toBe(403);

    const read = await agent.get(`${BASE}/${id}`);
    expect(read.status).toBe(200);
  });
});

describe('Isolation multi-tenant', () => {
  it('interdit à une entreprise de lire, modifier ou supprimer les clients d’une autre', async () => {
    const a = await register({ email: 'a@example.com', company: 'Alpha' });
    const b = await register({ email: 'b@example.com', company: 'Beta' });

    const created = await createClient(a.agent, a.csrf, { name: 'Client Alpha' });
    const id = created.body.data.id;

    expect((await b.agent.get(BASE)).body.meta.total).toBe(0);
    expect((await b.agent.get(`${BASE}/${id}`)).status).toBe(404);

    const patch = await b.agent
      .patch(`${BASE}/${id}`)
      .set('X-CSRF-Token', b.csrf)
      .send({ name: 'Vol' });
    expect(patch.status).toBe(404);

    const removed = await b.agent.delete(`${BASE}/${id}`).set('X-CSRF-Token', b.csrf);
    expect(removed.status).toBe(404);

    const detail = await a.agent.get(`${BASE}/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.name).toBe('Client Alpha');
    expect((await a.agent.get(BASE)).body.meta.total).toBe(1);
  });
});
