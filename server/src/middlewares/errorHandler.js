import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let status = Number.isInteger(error.status) ? error.status : 500;
  let code = error.code ?? (status >= 500 ? 'INTERNAL' : 'REQUEST_ERROR');
  let message = status >= 500 ? 'Erreur interne du serveur.' : error.message;

  if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Corps de requête JSON invalide.';
  }

  if (status >= 500) {
    logger.error({ err: error }, 'Erreur serveur');
  } else {
    logger.warn({ code, message }, 'Erreur de requête');
  }

  const body = { error: { code, message } };

  if (error.details !== undefined) {
    body.error.details = error.details;
  }

  res.status(status).json(body);
}
