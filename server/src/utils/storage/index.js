import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { createLocalStorage } from './local.js';

const serverRoot = fileURLToPath(new URL('../../../', import.meta.url));

export const storage = createLocalStorage(path.resolve(serverRoot, env.UPLOAD_DIR));
