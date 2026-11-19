import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorage } from '../src/utils/storage/local.js';

let directory;
let storage;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'relancepro-storage-'));
  storage = createLocalStorage(directory);
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('storage local', () => {
  it('écrit, lit et supprime un fichier', async () => {
    const filename = await storage.put(Buffer.from('contenu'), '.png');

    expect(filename.endsWith('.png')).toBe(true);
    expect(await storage.exists(filename)).toBe(true);
    expect((await storage.get(filename)).toString()).toBe('contenu');

    await storage.remove(filename);

    expect(await storage.exists(filename)).toBe(false);
  });

  it('rejette un nom de fichier avec traversée de répertoire', async () => {
    await expect(storage.get('../secret.txt')).rejects.toThrow('Nom de fichier invalide.');
    await expect(storage.get('..\\secret.txt')).rejects.toThrow('Nom de fichier invalide.');
  });

  it('rejette une extension invalide', async () => {
    await expect(storage.put(Buffer.from('x'), '../exe')).rejects.toThrow(
      'Extension de fichier invalide.',
    );
  });

  it('rejette un contenu qui n’est pas un Buffer', async () => {
    await expect(storage.put('texte', '.txt')).rejects.toThrow('Contenu de fichier invalide.');
  });
});
