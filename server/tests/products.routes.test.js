import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../src/db/migrate.js';

const BASE = '/api/v1/products';
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

function createProduct(agent, csrf, body) {
  return agent.post(BASE).set('X-CSRF-Token', csrf).send(body);
}

async function cleanDatabase() {
  await pool.query('UPDATE sessions SET replaced_by_id = NULL');
  await pool.query('DELETE FROM products');
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

describe('CRUD produits', () => {
  it('crée, liste, lit, modifie puis supprime un produit', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });

    const created = await createProduct(agent, csrf, {
      type: 'product',
      name: 'Chaise',
      description: 'Chaise en bois',
      unit: 'pièce',
      unit_price: 1500,
    });

    expect(created.status).toBe(201);
    expect(typeof created.body.data.id).toBe('string');
    expect(created.body.data.id).toMatch(/^\d+$/);
    expect(typeof created.body.data.unitPrice).toBe('number');
    expect(created.body.data).toMatchObject({
      type: 'product',
      name: 'Chaise',
      description: 'Chaise en bois',
      unit: 'pièce',
      unitPrice: 1500,
      taxRate: '18.00',
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
    expect(detail.body.data.name).toBe('Chaise');

    const updated = await agent
      .patch(`${BASE}/${id}`)
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Table', unit_price: 2000, is_active: false });

    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Table');
    expect(updated.body.data.unitPrice).toBe(2000);
    expect(updated.body.data.isActive).toBe(false);

    const removed = await agent.delete(`${BASE}/${id}`).set('X-CSRF-Token', csrf);
    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');

    expect((await agent.get(`${BASE}/${id}`)).status).toBe(404);
    expect((await agent.get(BASE)).body.meta.total).toBe(0);
  });

  it('filtre par recherche, type et statut, et pagine', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });

    await createProduct(agent, csrf, { type: 'product', name: 'Chaise' });
    await createProduct(agent, csrf, { type: 'product', name: 'Chaise longue' });
    await createProduct(agent, csrf, { type: 'service', name: 'Nettoyage', is_active: false });

    const search = await agent.get(`${BASE}?search=chaise`);
    expect(search.status).toBe(200);
    expect(search.body.meta.total).toBe(2);

    const type = await agent.get(`${BASE}?type=product`);
    expect(type.status).toBe(200);
    expect(type.body.meta.total).toBe(2);

    const service = await agent.get(`${BASE}?type=service`);
    expect(service.status).toBe(200);
    expect(service.body.meta.total).toBe(1);

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
    expect(page.body.data[0].name).toBe('Nettoyage');
  });

  it('accepte le prix maximal 999 999 999 999 et le renvoie en nombre', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });

    const created = await createProduct(agent, csrf, {
      type: 'product',
      name: 'Prix maximal',
      unit_price: 999999999999,
    });

    expect(created.status).toBe(201);
    expect(created.body.data.unitPrice).toBe(999999999999);
    expect(typeof created.body.data.unitPrice).toBe('number');
  });

  it('renvoie 404 pour un produit inexistant', async () => {
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
      await request(app).post(BASE).send({ type: 'product', name: 'Chaise' }),
      await request(app).patch(`${BASE}/1`).send({ name: 'Chaise' }),
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

    const emptyName = await createProduct(agent, csrf, { type: 'product', name: '   ' });
    expect(emptyName.status).toBe(422);
    expect(emptyName.body.error.code).toBe('VALIDATION_ERROR');

    const badType = await createProduct(agent, csrf, { type: 'other', name: 'Chaise' });
    expect(badType.status).toBe(422);

    const stringPrice = await createProduct(agent, csrf, {
      type: 'product',
      name: 'Chaise',
      unit_price: '1500',
    });
    expect(stringPrice.status).toBe(422);

    const decimalPrice = await createProduct(agent, csrf, {
      type: 'product',
      name: 'Chaise',
      unit_price: 12.5,
    });
    expect(decimalPrice.status).toBe(422);

    const tooHigh = await createProduct(agent, csrf, {
      type: 'product',
      name: 'Chaise',
      unit_price: 1000000000000,
    });
    expect(tooHigh.status).toBe(422);

    const massAssignment = await createProduct(agent, csrf, {
      type: 'product',
      name: 'Chaise',
      company_id: '42',
      created_by: '7',
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

    const badType = await agent.get(`${BASE}?type=other`);
    expect(badType.status).toBe(422);
  });

  it('rejette une modification vide', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const created = await createProduct(agent, csrf, { type: 'product', name: 'Chaise' });

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
    const created = await createProduct(agent, csrf, { type: 'product', name: 'Chaise' });
    const id = created.body.data.id;

    const noHeader = await agent.post(BASE).send({ type: 'product', name: 'Sans jeton' });
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
  it('interdit à une entreprise de lire, modifier ou supprimer les produits d’une autre', async () => {
    const a = await register({ email: 'a@example.com', company: 'Alpha' });
    const b = await register({ email: 'b@example.com', company: 'Beta' });

    const created = await createProduct(a.agent, a.csrf, {
      type: 'product',
      name: 'Produit Alpha',
    });
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
    expect(detail.body.data.name).toBe('Produit Alpha');
    expect((await a.agent.get(BASE)).body.meta.total).toBe(1);
  });
});
