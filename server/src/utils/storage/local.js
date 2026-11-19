import { constants } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/;
const EXTENSION_PATTERN = /^\.[a-zA-Z0-9]{1,8}$/;

function assertFilename(filename) {
  if (typeof filename !== 'string' || !FILENAME_PATTERN.test(filename) || filename.includes('..')) {
    throw new Error('Nom de fichier invalide.');
  }

  return filename;
}

export function createLocalStorage(baseDir) {
  const root = path.resolve(baseDir);

  function resolvePath(filename) {
    const target = path.resolve(root, assertFilename(filename));

    if (!target.startsWith(`${root}${path.sep}`)) {
      throw new Error('Chemin de fichier invalide.');
    }

    return target;
  }

  return {
    async put(buffer, extension = '') {
      if (!Buffer.isBuffer(buffer)) {
        throw new Error('Contenu de fichier invalide.');
      }

      if (extension && !EXTENSION_PATTERN.test(extension)) {
        throw new Error('Extension de fichier invalide.');
      }

      await mkdir(root, { recursive: true });

      const filename = `${randomUUID()}${extension.toLowerCase()}`;
      await writeFile(resolvePath(filename), buffer, { flag: 'wx' });

      return filename;
    },

    async get(filename) {
      return readFile(resolvePath(filename));
    },

    async remove(filename) {
      await rm(resolvePath(filename), { force: true });
    },

    async exists(filename) {
      try {
        await access(resolvePath(filename), constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },
  };
}
