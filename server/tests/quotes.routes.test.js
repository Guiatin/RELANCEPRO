import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../src/db/migrate.js';

const BASE = '/api/v1/quotes';
const CLIENTS = '/api/v1/clients';
const PASSWORD = 'MotDePasse!42';

function binaryParser(res, callback) {
  res.setEncoding('binary');
  res.data = '';
  res.on('data', (chunk) => {
    res.data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(res.data, 'binary')));
}

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

async function createClient(agent, csrf, name = 'Awa') {
  const response = await agent.post(CLIENTS).set('X-CSRF-Token', csrf).send({ name });

  return response.body.data.id;
}

function createQuote(agent, csrf, body) {
  return agent.post(BASE).set('X-CSRF-Token', csrf).send(body);
}

const ITEM = {
  description: 'Prestation',
  quantity: '2',
  unit_price: 1000,
  tax_rate: '18',
};

async function cleanDatabase() {
  await pool.query('DELETE FROM quote_items');
  await pool.query('DELETE FROM quotes');
  await pool.query('DELETE FROM document_sequences');
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

describe('CRUD devis', () => {
  it('crée, liste, lit, modifie puis supprime un brouillon', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const clientId = await createClient(agent, csrf);

    const created = await createQuote(agent, csrf, {
      client_id: clientId,
      client_reference: 'PO-1',
      items: [ITEM],
    });

    expect(created.status).toBe(201);
    expect(typeof created.body.data.id).toBe('string');
    expect(created.body.data).toMatchObject({
      clientId,
      clientName: 'Awa',
      status: 'draft',
      number: null,
      clientReference: 'PO-1',
      subtotal: 2000,
      discountTotal: 0,
      taxTotal: 360,
      total: 2360,
    });
    expect(created.body.data.items[0]).toMatchObject({
      description: 'Prestation',
      quantity: '2.00',
      unitPrice: 1000,
      lineSubtotal: 2000,
      lineTax: 360,
      lineTotal: 2360,
    });

    const id = created.body.data.id;

    const list = await agent.get(BASE);
    expect(list.status).toBe(200);
    expect(list.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(list.body.data[0]).toMatchObject({ id, clientName: 'Awa', itemCount: 1 });

    const detail = await agent.get(`${BASE}/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.items).toHaveLength(1);

    const updated = await agent
      .patch(`${BASE}/${id}`)
      .set('X-CSRF-Token', csrf)
      .send({ notes: 'Merci', items: [{ ...ITEM, quantity: '3' }] });

    expect(updated.status).toBe(200);
    expect(updated.body.data.notes).toBe('Merci');
    expect(updated.body.data.subtotal).toBe(3000);
    expect(updated.body.data.total).toBe(3540);

    const removed = await agent.delete(`${BASE}/${id}`).set('X-CSRF-Token', csrf);
    expect(removed.status).toBe(204);
    expect((await agent.get(`${BASE}/${id}`)).status).toBe(404);
    expect((await agent.get(BASE)).body.meta.total).toBe(0);
  });

  it('filtre par statut et référence', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const clientId = await createClient(agent, csrf);

    await createQuote(agent, csrf, {
      client_id: clientId,
      client_reference: 'PO-ALPHA',
      items: [],
    });
    await createQuote(agent, csrf, { client_id: clientId, items: [] });

    expect((await agent.get(`${BASE}?status=draft`)).body.meta.total).toBe(2);
    expect((await agent.get(`${BASE}?status=sent`)).body.meta.total).toBe(0);
    expect((await agent.get(`${BASE}?reference=PO-ALPHA`)).body.meta.total).toBe(1);
    expect((await agent.get(`${BASE}?client_id=${clientId}`)).body.meta.total).toBe(2);
  });
});

describe('Validation', () => {
  it('rejette les lignes et exonérations invalides', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const clientId = await createClient(agent, csrf);

    const noCode = await createQuote(agent, csrf, {
      client_id: clientId,
      items: [{ ...ITEM, tax_rate: '0' }],
    });
    expect(noCode.status).toBe(422);
    expect(noCode.body.error.code).toBe('VALIDATION_ERROR');

    const codeWithTax = await createQuote(agent, csrf, {
      client_id: clientId,
      items: [{ ...ITEM, tax_exemption_code: 'legal' }],
    });
    expect(codeWithTax.status).toBe(422);

    const decimalPrice = await createQuote(agent, csrf, {
      client_id: clientId,
      items: [{ ...ITEM, unit_price: 12.5 }],
    });
    expect(decimalPrice.status).toBe(422);

    const massAssignment = await createQuote(agent, csrf, {
      client_id: clientId,
      company_id: '9',
      items: [],
    });
    expect(massAssignment.status).toBe(422);

    const badStatus = await agent.get(`${BASE}?status=paid`);
    expect(badStatus.status).toBe(422);
  });

  it('refuse un client inexistant', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });

    const response = await createQuote(agent, csrf, { client_id: '999999', items: [] });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Envoi et statuts', () => {
  it('attribue un numéro à l’envoi, fige le devis puis accepte', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const clientId = await createClient(agent, csrf);
    const created = await createQuote(agent, csrf, { client_id: clientId, items: [ITEM] });
    const id = created.body.data.id;

    const sent = await agent.post(`${BASE}/${id}/mark-sent`).set('X-CSRF-Token', csrf);

    expect(sent.status).toBe(200);
    expect(sent.body.data.status).toBe('sent');
    expect(sent.body.data.number).toMatch(/^DEV-\d{4}-\d{4}$/);
    expect(sent.body.data.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sent.body.data.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sent.body.data.clientSnapshot).toMatchObject({ name: 'Awa' });
    expect(sent.body.data.issuerSnapshot).toMatchObject({ name: 'Alpha' });

    const patch = await agent
      .patch(`${BASE}/${id}`)
      .set('X-CSRF-Token', csrf)
      .send({ notes: 'Interdit' });
    expect(patch.status).toBe(409);

    const remove = await agent.delete(`${BASE}/${id}`).set('X-CSRF-Token', csrf);
    expect(remove.status).toBe(409);

    const again = await agent.post(`${BASE}/${id}/mark-sent`).set('X-CSRF-Token', csrf);
    expect(again.status).toBe(409);

    const accepted = await agent
      .post(`${BASE}/${id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'accepted' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('accepted');

    const invalid = await agent
      .post(`${BASE}/${id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'draft' });
    expect(invalid.status).toBe(422);
  });

  it('refuse l’envoi d’un devis sans ligne', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const clientId = await createClient(agent, csrf);
    const created = await createQuote(agent, csrf, { client_id: clientId, items: [] });

    const sent = await agent
      .post(`${BASE}/${created.body.data.id}/mark-sent`)
      .set('X-CSRF-Token', csrf);

    expect(sent.status).toBe(422);
  });
});

describe('PDF devis', () => {
  it('génère un PDF pour un brouillon puis pour un devis envoyé', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const clientId = await createClient(agent, csrf);
    const created = await createQuote(agent, csrf, {
      client_id: clientId,
      items: [ITEM],
      notes: 'Merci',
      terms: 'Paiement à 30 jours.',
    });
    const id = created.body.data.id;

    const draft = await agent.get(`${BASE}/${id}/pdf`).buffer(true).parse(binaryParser);

    expect(draft.status).toBe(200);
    expect(draft.headers['content-type']).toContain('application/pdf');
    expect(draft.headers['content-disposition']).toContain('devis-brouillon.pdf');
    expect(Buffer.isBuffer(draft.body)).toBe(true);
    expect(draft.body.subarray(0, 5).toString()).toBe('%PDF-');

    await agent.post(`${BASE}/${id}/mark-sent`).set('X-CSRF-Token', csrf);

    const sent = await agent.get(`${BASE}/${id}/pdf`).buffer(true).parse(binaryParser);

    expect(sent.status).toBe(200);
    expect(sent.headers['content-disposition']).toMatch(/DEV-\d{4}-\d{4}\.pdf/);
    expect(sent.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('gère un devis long (pagination) avec exonérations', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const clientId = await createClient(agent, csrf);
    const items = Array.from({ length: 40 }, (_, index) => ({
      description: `Ligne ${index + 1} — prestation détaillée`,
      quantity: '1',
      unit_price: 1000 + index,
      tax_rate: '0',
      tax_exemption_code: 'other',
      tax_exemption_reason: 'Marché public exonéré',
    }));

    const created = await createQuote(agent, csrf, {
      client_id: clientId,
      items,
      notes: 'Note '.repeat(400),
      terms: 'Condition '.repeat(300),
    });

    expect(created.status).toBe(201);

    const pdf = await agent
      .get(`${BASE}/${created.body.data.id}/pdf`)
      .buffer(true)
      .parse(binaryParser);

    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.body.length).toBeGreaterThan(2000);
  });

  it('interdit le PDF d’un devis d’une autre entreprise', async () => {
    const a = await register({ email: 'a@example.com', company: 'Alpha' });
    const b = await register({ email: 'b@example.com', company: 'Beta' });
    const clientId = await createClient(a.agent, a.csrf);
    const created = await createQuote(a.agent, a.csrf, { client_id: clientId, items: [ITEM] });

    const response = await b.agent.get(`${BASE}/${created.body.data.id}/pdf`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Authentification et CSRF', () => {
  it('refuse l’accès sans authentification', async () => {
    const responses = [
      await request(app).get(BASE),
      await request(app).get(`${BASE}/1`),
      await request(app).post(BASE).send({ client_id: '1', items: [] }),
      await request(app).patch(`${BASE}/1`).send({ notes: 'x' }),
      await request(app).delete(`${BASE}/1`),
      await request(app).post(`${BASE}/1/mark-sent`),
      await request(app).get(`${BASE}/1/pdf`),
    ];

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('refuse les écritures sans jeton CSRF valide', async () => {
    const { agent, csrf } = await register({ email: 'a@example.com', company: 'Alpha' });
    const clientId = await createClient(agent, csrf);

    const noHeader = await agent.post(BASE).send({ client_id: clientId, items: [] });
    expect(noHeader.status).toBe(403);
    expect(noHeader.body.error.code).toBe('FORBIDDEN');
  });
});

describe('Isolation multi-tenant', () => {
  it('interdit à une entreprise de voir ou modifier les devis d’une autre', async () => {
    const a = await register({ email: 'a@example.com', company: 'Alpha' });
    const b = await register({ email: 'b@example.com', company: 'Beta' });
    const clientId = await createClient(a.agent, a.csrf);

    const created = await createQuote(a.agent, a.csrf, { client_id: clientId, items: [ITEM] });
    const id = created.body.data.id;

    expect((await b.agent.get(BASE)).body.meta.total).toBe(0);
    expect((await b.agent.get(`${BASE}/${id}`)).status).toBe(404);

    const patch = await b.agent
      .patch(`${BASE}/${id}`)
      .set('X-CSRF-Token', b.csrf)
      .send({ notes: 'Vol' });
    expect(patch.status).toBe(404);

    const removed = await b.agent.delete(`${BASE}/${id}`).set('X-CSRF-Token', b.csrf);
    expect(removed.status).toBe(404);

    expect((await a.agent.get(`${BASE}/${id}`)).status).toBe(200);
  });
});
