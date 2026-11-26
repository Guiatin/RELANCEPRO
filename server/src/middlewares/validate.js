import { validationError } from '../utils/errors.js';

function toDetails(issue) {
  if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
    return issue.keys.map((key) => ({ field: key, message: 'Champ non autorisé.' }));
  }

  return [{ field: issue.path.join('.'), message: issue.message }];
}

function invalid(schema, value, next) {
  const result = schema.safeParse(value);

  if (!result.success) {
    next(validationError(result.error.issues.flatMap(toDetails)));

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
