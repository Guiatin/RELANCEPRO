import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  create,
  findAllByCompany,
  findById,
  softDelete,
  update,
} from '../src/repositories/products.js';

async function createCompany(name) {
  const [result] = await pool.execute('INSERT INTO companies (name) VALUES (?)', [name]);

  return String(result.insertId);
}

async function cleanDatabase() {
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
  it('crée, lit, modifie puis supprime logiquement un produit', async () => {
    const companyId = await createCompany('Alpha');
    const id = await create(pool, companyId, {
      type: 'product',
      name: 'Chaise',
      description: 'Chaise en bois',
      unit: 'pièce',
      unitPrice: 1500,
      taxRate: 18,
      isActive: true,
    });

    expect(typeof id).toBe('string');
    expect(id).toMatch(/^\d+$/);

    const product = await findById(pool, companyId, id);
    expect(product).toMatchObject({
      id,
      companyId,
      type: 'product',
      name: 'Chaise',
      description: 'Chaise en bois',
      unit: 'pièce',
      unitPrice: 1500,
      taxRate: '18.00',
      isActive: true,
    });

    const result = await update(pool, companyId, id, {
      name: 'Chaise haute',
      unitPrice: 2000,
      isActive: false,
    });

    expect(result.updated).toBe(true);
    expect(result.product).toMatchObject({
      name: 'Chaise haute',
      unitPrice: 2000,
      isActive: false,
    });

    expect(await softDelete(pool, companyId, id)).toBe(true);
    expect(await findById(pool, companyId, id)).toBeNull();
    expect((await findAllByCompany(pool, companyId)).total).toBe(0);
  });

  it('applique les valeurs par défaut de la migration', async () => {
    const companyId = await createCompany('Alpha');
    const id = await create(pool, companyId, { type: 'service', name: 'Sans prix' });

    expect(await findById(pool, companyId, id)).toMatchObject({
      description: null,
      unit: null,
      unitPrice: 0,
      taxRate: '18.00',
      isActive: true,
    });
  });
});

describe('Recherche, filtres et pagination', () => {
  it('recherche et filtre par type et statut', async () => {
    const companyId = await createCompany('Alpha');

    await create(pool, companyId, {
      type: 'product',
      name: 'Chaise',
      description: 'Bois',
      isActive: true,
    });
    await create(pool, companyId, {
      type: 'service',
      name: 'Nettoyage',
      description: 'Bureaux',
      isActive: true,
    });
    await create(pool, companyId, {
      type: 'product',
      name: 'Table',
      description: 'Métal',
      isActive: false,
    });

    expect((await findAllByCompany(pool, companyId, { search: 'chaise' })).total).toBe(1);
    expect((await findAllByCompany(pool, companyId, { search: 'bureaux' })).total).toBe(1);
    expect((await findAllByCompany(pool, companyId, { type: 'service' })).total).toBe(1);
    expect((await findAllByCompany(pool, companyId, { type: 'product' })).total).toBe(2);
    expect((await findAllByCompany(pool, companyId, { active: true })).total).toBe(2);
    expect((await findAllByCompany(pool, companyId, { active: false })).total).toBe(1);

    const combined = await findAllByCompany(pool, companyId, {
      type: 'product',
      active: 'false',
    });
    expect(combined.total).toBe(1);
    expect(combined.data[0].name).toBe('Table');
  });

  it('échappe les caractères spéciaux de la recherche LIKE', async () => {
    const companyId = await createCompany('Alpha');

    await create(pool, companyId, { type: 'product', name: '100% coton' });
    await create(pool, companyId, { type: 'product', name: '100 coton' });

    const result = await findAllByCompany(pool, companyId, { search: '100%' });
    expect(result.total).toBe(1);
    expect(result.data[0].name).toBe('100% coton');
  });

  it('pagine les résultats avec les limites du projet', async () => {
    const companyId = await createCompany('Alpha');

    await create(pool, companyId, { type: 'product', name: 'A' });
    await create(pool, companyId, { type: 'product', name: 'B' });
    await create(pool, companyId, { type: 'product', name: 'C' });

    const page1 = await findAllByCompany(pool, companyId, { page: 1, limit: 2 });
    expect(page1.total).toBe(3);
    expect(page1.data.map((product) => product.name)).toEqual(['A', 'B']);

    const page2 = await findAllByCompany(pool, companyId, { page: 2, limit: 2 });
    expect(page2.data.map((product) => product.name)).toEqual(['C']);

    const clampedLimit = await findAllByCompany(pool, companyId, { page: 1, limit: 500 });
    expect(clampedLimit.data).toHaveLength(3);

    const invalidValues = await findAllByCompany(pool, companyId, { page: 0, limit: 0 });
    expect(invalidValues.data).toHaveLength(3);
  });
});

describe('Suppression logique', () => {
  it('exclut les éléments supprimés et ne les supprime qu’une fois', async () => {
    const companyId = await createCompany('Alpha');
    const id = await create(pool, companyId, { type: 'service', name: 'Maintenance' });

    expect(await softDelete(pool, companyId, id)).toBe(true);
    expect(await softDelete(pool, companyId, id)).toBe(false);
    expect(await findById(pool, companyId, id)).toBeNull();
    expect((await findAllByCompany(pool, companyId)).total).toBe(0);
  });
});

describe('Isolation multi-tenant', () => {
  it('interdit à une entreprise de lire, modifier ou supprimer les produits d’une autre', async () => {
    const alpha = await createCompany('Alpha');
    const beta = await createCompany('Beta');
    const id = await create(pool, alpha, { type: 'product', name: 'Produit Alpha' });

    expect((await findAllByCompany(pool, beta)).total).toBe(0);
    expect(await findById(pool, beta, id)).toBeNull();

    const result = await update(pool, beta, id, { name: 'Vol' });
    expect(result).toEqual({ product: null, updated: false });

    expect(await softDelete(pool, beta, id)).toBe(false);
    expect((await findById(pool, alpha, id)).name).toBe('Produit Alpha');
    expect((await findAllByCompany(pool, alpha)).total).toBe(1);
  });
});

describe('Identifiants et montants', () => {
  it('conserve les identifiants en chaînes et le prix en nombre', async () => {
    const companyId = await createCompany('Alpha');
    const id = await create(pool, companyId, {
      type: 'product',
      name: 'Gros montant',
      unitPrice: 999999999999,
    });

    const product = await findById(pool, companyId, id);
    expect(typeof product.id).toBe('string');
    expect(typeof product.companyId).toBe('string');
    expect(product.id).toBe(id);
    expect(product.companyId).toBe(companyId);
    expect(typeof product.unitPrice).toBe('number');
    expect(product.unitPrice).toBe(999999999999);
  });
});

describe('Mise à jour sans changement', () => {
  it('distingue un no-op d’un élément inexistant', async () => {
    const companyId = await createCompany('Alpha');
    const id = await create(pool, companyId, {
      type: 'product',
      name: 'Identique',
      unitPrice: 1000,
    });

    const emptyUpdate = await update(pool, companyId, id, {});
    expect(emptyUpdate.product?.id).toBe(id);
    expect(emptyUpdate.updated).toBe(false);

    const sameValues = await update(pool, companyId, id, {
      name: 'Identique',
      unitPrice: 1000,
    });
    expect(sameValues.product?.id).toBe(id);
    expect(sameValues.updated).toBe(false);

    const missing = await update(pool, companyId, '999999999', { name: 'Absent' });
    expect(missing).toEqual({ product: null, updated: false });
  });
});
