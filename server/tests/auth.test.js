import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../src/db/migrate.js';
import { normalizeRecoveryCode, sha256 } from '../src/utils/crypto.js';

const REGISTER = {
  company_name: 'Acme SARL',
  full_name: 'Awa Traoré',
  email: 'awa@example.com',
  password: 'MotDePasse!42',
};

const RECOVERY_PATTERN =
  /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;

function setCookies(response) {
  return response.headers['set-cookie'] ?? [];
}

function cookieValue(response, name) {
  const cookie = setCookies(response).find((value) => value.startsWith(`${name}=`));

  if (!cookie) return null;

  return cookie.slice(name.length + 1).split(';')[0];
}

function csrfToken(response) {
  return cookieValue(response, 'csrf_token');
}

function refreshToken(response) {
  return cookieValue(response, 'rp_rt');
}

async function registerAgent(overrides = {}) {
  const agent = request.agent(app);
  const response = await agent.post('/api/v1/auth/register').send({ ...REGISTER, ...overrides });

  return { agent, response };
}

async function loginAgent(email = REGISTER.email, password = REGISTER.password) {
  const agent = request.agent(app);
  const response = await agent.post('/api/v1/auth/login').send({ email, password });

  return { agent, response };
}

async function cleanDatabase() {
  await pool.query('UPDATE sessions SET replaced_by_id = NULL');
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

describe('Inscription', () => {
  it('crée entreprise et propriétaire, affiche le code une seule fois et ouvre une session', async () => {
    const { agent, response } = await registerAgent();

    expect(response.status).toBe(201);
    expect(typeof response.body.data.user.id).toBe('string');
    expect(response.body.data.user.id).toMatch(/^\d+$/);
    expect(typeof response.body.data.company.id).toBe('string');
    expect(response.body.data.user.full_name).toBe(REGISTER.full_name);
    expect(response.body.data.user.role).toBe('owner');
    expect(response.body.data.recovery_code).toMatch(RECOVERY_PATTERN);
    expect(response.body.data).not.toHaveProperty('password');

    const cookies = setCookies(response).join('\n');
    expect(cookies).toMatch(/rp_at=.*HttpOnly/i);
    expect(cookies).toMatch(/rp_rt=.*HttpOnly/i);
    expect(cookies).toMatch(/rp_rt=.*Path=\/api\/v1\/auth/i);
    expect(cookies).toMatch(/SameSite=Lax/i);
    expect(cookies).not.toMatch(/rp_at=.*Secure/i);

    const csrfCookie = setCookies(response).find((value) => value.startsWith('csrf_token='));
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toMatch(/HttpOnly/i);

    const [users] = await pool.query('SELECT password_hash, email FROM users WHERE email = ?', [
      REGISTER.email,
    ]);
    expect(users).toHaveLength(1);
    expect(users[0].password_hash).toMatch(/^\$2b\$12\$/);
    expect(users[0].password_hash).not.toContain(REGISTER.password);

    const rawCode = response.body.data.recovery_code.replaceAll('-', '');
    const [codes] = await pool.query('SELECT code_hash, used_at, revoked_at FROM recovery_codes');
    expect(codes).toHaveLength(1);
    expect(codes[0].code_hash).toBe(sha256(normalizeRecoveryCode(rawCode)));
    expect(codes[0].used_at).toBeNull();
    expect(codes[0].revoked_at).toBeNull();

    const [audits] = await pool.query(
      "SELECT action, metadata FROM audit_logs WHERE action = 'auth.register'",
    );
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain(REGISTER.password);
    expect(JSON.stringify(audits)).not.toContain(rawCode);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(REGISTER.email);
    expect(me.body.data.company.name).toBe(REGISTER.company_name);
    expect(JSON.stringify(me.body)).not.toContain('recovery_code');
  });

  it('refuse un email déjà utilisé, sans tenir compte de la casse', async () => {
    await registerAgent();

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...REGISTER, email: REGISTER.email.toUpperCase() });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');

    const [companies] = await pool.query('SELECT id FROM companies');
    expect(companies).toHaveLength(1);
  });

  it('rejette les données invalides et le mass assignment', async () => {
    const weak = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...REGISTER, password: 'court' });

    expect(weak.status).toBe(422);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    expect(weak.body.error.details.some((detail) => detail.field === 'password')).toBe(true);

    const massAssignment = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...REGISTER, company_id: '999' });

    expect(massAssignment.status).toBe(422);

    const [companies] = await pool.query('SELECT id FROM companies');
    expect(companies).toHaveLength(0);
  });
});

describe('Connexion et session', () => {
  it('connecte, restaure la session et ne renvoie jamais le code de récupération', async () => {
    await registerAgent();

    const { agent, response } = await loginAgent();

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(REGISTER.email);
    expect(response.body.data).not.toHaveProperty('recovery_code');
    expect(csrfToken(response)).toBeTruthy();

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.company.name).toBe(REGISTER.company_name);
    expect(JSON.stringify(me.body)).not.toContain('recovery_code');

    const refreshed = await agent
      .post('/api/v1/auth/refresh')
      .set('X-CSRF-Token', csrfToken(response));

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data).not.toHaveProperty('recovery_code');
  });

  it('renvoie le même message pour un mauvais mot de passe et un email inconnu', async () => {
    await registerAgent();

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: REGISTER.email, password: 'Mauvais!42' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inconnu@example.com', password: 'Mauvais!42' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe(unknownEmail.body.error.code);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);

    const [audits] = await pool.query(
      "SELECT id FROM audit_logs WHERE action = 'auth.login_failed'",
    );
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it('rejette un utilisateur désactivé', async () => {
    const { agent } = await registerAgent();
    await pool.query('UPDATE users SET is_active = 0 WHERE email = ?', [REGISTER.email]);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(401);

    const { response } = await loginAgent();
    expect(response.status).toBe(401);
  });

  it('fait tourner le refresh et révoque toutes les sessions en cas de réutilisation', async () => {
    const { agent, response } = await registerAgent();
    const oldRefresh = refreshToken(response);
    const csrf = csrfToken(response);

    const refreshed = await agent.post('/api/v1/auth/refresh').set('X-CSRF-Token', csrf);
    const newRefresh = refreshToken(refreshed);

    expect(refreshed.status).toBe(200);
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(oldRefresh);

    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`rp_rt=${oldRefresh}`, 'csrf_token=probe'])
      .set('X-CSRF-Token', 'probe');

    expect(reuse.status).toBe(401);

    const afterRevocation = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`rp_rt=${newRefresh}`, 'csrf_token=probe'])
      .set('X-CSRF-Token', 'probe');

    expect(afterRevocation.status).toBe(401);

    const [audits] = await pool.query(
      "SELECT id FROM audit_logs WHERE action = 'auth.refresh_reuse'",
    );
    expect(audits).toHaveLength(1);
  });

  it('déconnecte, révoque le refresh et efface les cookies', async () => {
    const { agent, response } = await registerAgent();
    const csrf = csrfToken(response);
    const refresh = refreshToken(response);

    const logout = await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf);

    expect(logout.status).toBe(204);

    const [sessions] = await pool.query('SELECT revoked_at FROM sessions WHERE token_hash = ?', [
      sha256(refresh),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].revoked_at).not.toBeNull();

    const cleared = setCookies(logout).join('\n');
    expect(cleared).toMatch(/rp_at=;/);
    expect(cleared).toMatch(/rp_rt=;/);

    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`rp_rt=${refresh}`, 'csrf_token=probe'])
      .set('X-CSRF-Token', 'probe');
    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe('Mot de passe et code de récupération', () => {
  it('réinitialise avec le code, révoque les sessions et fait tourner le code', async () => {
    const { response } = await registerAgent();
    const oldCode = response.body.data.recovery_code;
    const oldRefresh = refreshToken(response);

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: REGISTER.email,
        recovery_code: oldCode.toLowerCase().replaceAll('-', ' '),
        new_password: 'Nouveau!42',
      });

    expect(reset.status).toBe(200);
    expect(reset.body.data.recovery_code).toMatch(RECOVERY_PATTERN);
    expect(reset.body.data.recovery_code).not.toBe(oldCode);

    const cleared = setCookies(reset).join('\n');
    expect(cleared).toMatch(/rp_at=;/);
    expect(cleared).toMatch(/rp_rt=;/);
    expect(cleared).toMatch(/csrf_token=;/);

    const oldPasswordLogin = await loginAgent(REGISTER.email, REGISTER.password);
    expect(oldPasswordLogin.response.status).toBe(401);

    const newPasswordLogin = await loginAgent(REGISTER.email, 'Nouveau!42');
    expect(newPasswordLogin.response.status).toBe(200);

    const reuse = await request(app).post('/api/v1/auth/reset-password').send({
      email: REGISTER.email,
      recovery_code: oldCode,
      new_password: 'Encore!42',
    });
    expect(reuse.status).toBe(401);

    const refreshAfterReset = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`rp_rt=${oldRefresh}`, 'csrf_token=probe'])
      .set('X-CSRF-Token', 'probe');
    expect(refreshAfterReset.status).toBe(401);

    const newRawCode = reset.body.data.recovery_code.replaceAll('-', '');
    const [codes] = await pool.query(
      'SELECT code_hash, used_at, revoked_at FROM recovery_codes ORDER BY id',
    );
    expect(codes).toHaveLength(2);
    expect(codes[0].used_at).not.toBeNull();
    expect(codes[1].used_at).toBeNull();
    expect(codes[1].revoked_at).toBeNull();
    expect(codes[1].code_hash).toBe(sha256(normalizeRecoveryCode(newRawCode)));
  });

  it('change le mot de passe, révoque les autres sessions et refuse un mauvais mot de passe actuel', async () => {
    const { agent, response } = await registerAgent();
    const csrf = csrfToken(response);

    const second = await loginAgent();
    const secondRefresh = refreshToken(second.response);

    const wrong = await agent
      .patch('/api/v1/auth/password')
      .set('X-CSRF-Token', csrf)
      .send({ current_password: 'Mauvais!42', new_password: 'Nouveau!42' });
    expect(wrong.status).toBe(403);

    const change = await agent
      .patch('/api/v1/auth/password')
      .set('X-CSRF-Token', csrf)
      .send({ current_password: REGISTER.password, new_password: 'Nouveau!42' });
    expect(change.status).toBe(200);

    const oldLogin = await loginAgent(REGISTER.email, REGISTER.password);
    expect(oldLogin.response.status).toBe(401);

    const newLogin = await loginAgent(REGISTER.email, 'Nouveau!42');
    expect(newLogin.response.status).toBe(200);

    const revoked = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`rp_rt=${secondRefresh}`, 'csrf_token=probe'])
      .set('X-CSRF-Token', 'probe');
    expect(revoked.status).toBe(401);

    const kept = await agent.post('/api/v1/auth/refresh').set('X-CSRF-Token', csrf);
    expect(kept.status).toBe(200);
  });

  it('régénère le code de récupération et invalide le précédent', async () => {
    const { agent, response } = await registerAgent();
    const csrf = csrfToken(response);
    const oldCode = response.body.data.recovery_code;

    const regenerate = await agent
      .post('/api/v1/auth/recovery-code/regenerate')
      .set('X-CSRF-Token', csrf)
      .send({ password: REGISTER.password });

    expect(regenerate.status).toBe(200);
    expect(regenerate.body.data.recovery_code).toMatch(RECOVERY_PATTERN);
    expect(regenerate.body.data.recovery_code).not.toBe(oldCode);

    const oldCodeAttempt = await request(app).post('/api/v1/auth/reset-password').send({
      email: REGISTER.email,
      recovery_code: oldCode,
      new_password: 'Nouveau!42',
    });
    expect(oldCodeAttempt.status).toBe(401);

    const newCodeAttempt = await request(app).post('/api/v1/auth/reset-password').send({
      email: REGISTER.email,
      recovery_code: regenerate.body.data.recovery_code,
      new_password: 'Nouveau!42',
    });
    expect(newCodeAttempt.status).toBe(200);
  });
});

describe('Protection CSRF', () => {
  it('refuse les écritures authentifiées sans jeton CSRF', async () => {
    const { agent } = await registerAgent();

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(403);
    expect(logout.body.error.code).toBe('FORBIDDEN');

    const password = await agent
      .patch('/api/v1/auth/password')
      .send({ current_password: REGISTER.password, new_password: 'Nouveau!42' });
    expect(password.status).toBe(403);

    const refresh = await agent.post('/api/v1/auth/refresh');
    expect(refresh.status).toBe(403);
  });
});
