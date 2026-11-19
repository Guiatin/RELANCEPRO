export function apiErrorMessage(error, fallback = 'Une erreur est survenue. Réessayez.') {
  return error?.response?.data?.error?.message ?? fallback;
}

export function apiFieldErrors(error) {
  const details = error?.response?.data?.error?.details;

  if (!Array.isArray(details)) return {};

  return details.reduce((errors, detail) => {
    if (detail?.field && !errors[detail.field]) {
      errors[detail.field] = detail.message;
    }

    return errors;
  }, {});
}

export function zodFieldErrors(error) {
  return error.issues.reduce((errors, issue) => {
    const field = issue.path[0];

    if (field && !errors[field]) {
      errors[field] = issue.message;
    }

    return errors;
  }, {});
}
