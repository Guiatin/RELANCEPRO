import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const migrationsDir = fileURLToPath(new URL('./migrations/', import.meta.url));

export async function runMigrations() {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    multipleStatements: true,
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [rows] = await connection.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.version));
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      console.log('Aucune migration en attente.');
      return;
    }

    for (const file of pending) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
      console.log(`Migration appliquée : ${file}`);
    }
  } finally {
    await connection.end();
  }
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runMigrations().catch((error) => {
    console.error('Échec des migrations :', error.message);
    process.exitCode = 1;
  });
}
