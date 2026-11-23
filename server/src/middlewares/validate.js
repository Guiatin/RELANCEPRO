import { validationError } from '../utils/errors.js';

function invalid(schema, value, next) {
  const result = schema.safeParse(value);

  if (!result.success) {
    next(
      validationError(
        result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      ),
    );

    return null;
  }

  return result.data;
}

export function validate(schema) {
  return (req, res, next) => {
    const data = invalid(schema, req.body, next);

    if (data === null) return;

    req.body = data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const data = invalid(schema, req.query, next);

    if (data === null) return;

    // Express 5 expose req.query via un getter sans setter : on masque la
    // propriété par la valeur validée au lieu d'une affectation interdite.
    Object.defineProperty(req, 'query', { value: data, configurable: true });
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const data = invalid(schema, req.params, next);

    if (data === null) return;

    Object.assign(req.params, data);
    next();
  };
}
