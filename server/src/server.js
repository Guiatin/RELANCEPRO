import { app } from './app.js';
import { env } from './config/env.js';
import { checkDatabase, pool } from './config/db.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`API RelancePro démarrée sur http://localhost:${env.PORT}`);
});

checkDatabase()
  .then(() => logger.info('Connexion MySQL établie'))
  .catch(() => logger.error('Connexion MySQL indisponible au démarrage'));

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Arrêt du serveur');

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  server.close(() => {
    pool
      .end()
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(forceExit);
        process.exit(0);
      });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
