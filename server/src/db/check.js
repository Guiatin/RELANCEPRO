import { checkDatabase, pool } from '../config/db.js';

try {
  await checkDatabase();
  console.log('Connexion MySQL OK');
} catch (error) {
  console.error('Connexion MySQL impossible :', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
