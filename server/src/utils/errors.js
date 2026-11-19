export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function validationError(details) {
  return new AppError(422, 'VALIDATION_ERROR', 'Données invalides.', details);
}

export function unauthenticated(message = 'Authentification requise.') {
  return new AppError(401, 'UNAUTHENTICATED', message);
}

export function forbidden(message = 'Accès refusé.') {
  return new AppError(403, 'FORBIDDEN', message);
}

export function conflict(message) {
  return new AppError(409, 'CONFLICT', message);
}

export function rateLimited(message = 'Trop de tentatives. Réessayez plus tard.') {
  return new AppError(429, 'RATE_LIMITED', message);
}
