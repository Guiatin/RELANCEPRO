import { describe, expect, it } from 'vitest';
import {
  clientIdParamSchema,
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from '../src/validators/clients.js';

function expectValid(schema, value) {
  const result = schema.safeParse(value);

  expect(result.success).toBe(true);

  return result.data;
}

function expectInvalid(schema, value) {
  expect(schema.safeParse(value).success).toBe(false);
}

describe('createClientSchema', () => {
  it('accepte un client minimal', () => {
    expectValid(createClientSchema, { name: 'Awa' });
  });

  it('accepte tous les champs facultatifs valides', () => {
    expectValid(createClientSchema, {
      name: 'Awa',
      contact_name: 'Kadi',
      email: 'awa@example.com',
      phone: '+22670000000',
      whatsapp: '+22670000000',
      address: 'Rue 12',
      city: 'Ouagadougou',
      notes: 'Client fidèle',
      is_active: true,
    });
  });

  it('nettoie les espaces du nom', () => {
    expect(expectValid(createClientSchema, { name: '  Awa  ' }).name).toBe('Awa');
  });

  it('refuse un nom absent', () => {
    expectInvalid(createClientSchema, {});
  });

  it('refuse un nom vide ou composé d’espaces', () => {
    expectInvalid(createClientSchema, { name: '' });
    expectInvalid(createClientSchema, { name: '   ' });
  });

  it('refuse un nom de plus de 120 caractères', () => {
    expectInvalid(createClientSchema, { name: 'a'.repeat(121) });
    expectValid(createClientSchema, { name: 'a'.repeat(120) });
  });

  it('refuse un contact de plus de 120 caractères', () => {
    expectInvalid(createClientSchema, { name: 'Awa', contact_name: 'a'.repeat(121) });
  });

  it('refuse un email invalide ou trop long', () => {
    expectInvalid(createClientSchema, { name: 'Awa', email: 'pas-un-email' });
    expectInvalid(createClientSchema, { name: 'Awa', email: `${'a'.repeat(181)}@example.com` });
    expectInvalid(createClientSchema, { name: 'Awa', email: '' });
  });

  it('refuse un téléphone ou un WhatsApp de plus de 40 caractères', () => {
    expectInvalid(createClientSchema, { name: 'Awa', phone: '1'.repeat(41) });
    expectInvalid(createClientSchema, { name: 'Awa', whatsapp: '1'.repeat(41) });
  });

  it('refuse une adresse de plus de 255 caractères et une ville de plus de 80 caractères', () => {
    expectInvalid(createClientSchema, { name: 'Awa', address: 'a'.repeat(256) });
    expectInvalid(createClientSchema, { name: 'Awa', city: 'a'.repeat(81) });
  });

  it('refuse un is_active non booléen', () => {
    expectInvalid(createClientSchema, { name: 'Awa', is_active: 'true' });
    expectInvalid(createClientSchema, { name: 'Awa', is_active: 1 });
  });

  it('refuse les propriétés inconnues et les champs réservés', () => {
    expectInvalid(createClientSchema, { name: 'Awa', company_id: '1' });
    expectInvalid(createClientSchema, { name: 'Awa', created_by: '1' });
    expectInvalid(createClientSchema, { name: 'Awa', id: '1' });
    expectInvalid(createClientSchema, { name: 'Awa', inconnu: true });
  });
});

describe('updateClientSchema', () => {
  it('accepte une modification partielle', () => {
    expectValid(updateClientSchema, { city: 'Bobo-Dioulasso' });
  });

  it('accepte tous les champs modifiables', () => {
    expectValid(updateClientSchema, {
      name: 'Awa',
      contact_name: 'Kadi',
      email: 'awa@example.com',
      phone: '+22670000000',
      whatsapp: '+22670000000',
      address: 'Rue 12',
      city: 'Ouagadougou',
      notes: 'Note',
      is_active: false,
    });
  });

  it('refuse un objet vide', () => {
    expectInvalid(updateClientSchema, {});
  });

  it('refuse un nom vide', () => {
    expectInvalid(updateClientSchema, { name: '' });
  });

  it('refuse un email invalide', () => {
    expectInvalid(updateClientSchema, { email: 'pas-un-email' });
  });

  it('refuse les propriétés inconnues et les champs réservés', () => {
    expectInvalid(updateClientSchema, { company_id: '1' });
    expectInvalid(updateClientSchema, { created_by: '1' });
    expectInvalid(updateClientSchema, { id: '1' });
    expectInvalid(updateClientSchema, { inconnu: true });
  });
});

describe('listClientsQuerySchema', () => {
  it('accepte une query vide', () => {
    expectValid(listClientsQuerySchema, {});
  });

  it('accepte les filtres valides et convertit page/limit en nombres', () => {
    const data = expectValid(listClientsQuerySchema, {
      search: 'awa',
      active: 'true',
      page: '2',
      limit: '100',
    });

    expect(data).toEqual({ search: 'awa', active: 'true', page: 2, limit: 100 });
  });

  it('accepte active à false', () => {
    expectValid(listClientsQuerySchema, { active: 'false' });
  });

  it('refuse un format de active autre que true/false', () => {
    expectInvalid(listClientsQuerySchema, { active: '1' });
    expectInvalid(listClientsQuerySchema, { active: true });
    expectInvalid(listClientsQuerySchema, { active: '' });
  });

  it('refuse une page invalide', () => {
    expectInvalid(listClientsQuerySchema, { page: '0' });
    expectInvalid(listClientsQuerySchema, { page: '-1' });
    expectInvalid(listClientsQuerySchema, { page: 'abc' });
    expectInvalid(listClientsQuerySchema, { page: '1.5' });
  });

  it('refuse une limite invalide', () => {
    expectInvalid(listClientsQuerySchema, { limit: '0' });
    expectInvalid(listClientsQuerySchema, { limit: '101' });
    expectInvalid(listClientsQuerySchema, { limit: 'abc' });
    expectValid(listClientsQuerySchema, { limit: '1' });
  });

  it('refuse une recherche de plus de 190 caractères', () => {
    expectInvalid(listClientsQuerySchema, { search: 'a'.repeat(191) });
    expectValid(listClientsQuerySchema, { search: 'a'.repeat(190) });
  });

  it('refuse les paramètres inconnus, dont company_id', () => {
    expectInvalid(listClientsQuerySchema, { company_id: '1' });
    expectInvalid(listClientsQuerySchema, { inconnu: true });
  });
});

describe('clientIdParamSchema', () => {
  it('accepte un identifiant numérique positif et le conserve en chaîne', () => {
    const data = expectValid(clientIdParamSchema, { id: '42' });

    expect(data.id).toBe('42');
    expect(typeof data.id).toBe('string');
  });

  it('accepte la borne maximale BIGINT UNSIGNED', () => {
    expectValid(clientIdParamSchema, { id: '18446744073709551615' });
  });

  it('refuse zéro et les zéros initiaux', () => {
    expectInvalid(clientIdParamSchema, { id: '0' });
    expectInvalid(clientIdParamSchema, { id: '007' });
  });

  it('refuse les identifiants non numériques', () => {
    expectInvalid(clientIdParamSchema, { id: 'abc' });
    expectInvalid(clientIdParamSchema, { id: '-1' });
    expectInvalid(clientIdParamSchema, { id: '' });
    expectInvalid(clientIdParamSchema, { id: ' 42 ' });
  });

  it('refuse un identifiant fourni en Number', () => {
    expectInvalid(clientIdParamSchema, { id: 42 });
  });

  it('refuse un identifiant dépassant BIGINT UNSIGNED', () => {
    expectInvalid(clientIdParamSchema, { id: '18446744073709551616' });
    expectInvalid(clientIdParamSchema, { id: '123456789012345678901' });
  });

  it('refuse les propriétés inconnues', () => {
    expectInvalid(clientIdParamSchema, { id: '42', company_id: '1' });
  });
});
