const amountFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const rateFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const number = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(number) ? number : null;
}

export function formatAmount(value) {
  const amount = toNumber(value);

  return amount === null ? '—' : `${amountFormatter.format(amount)} FCFA`;
}

export function formatTaxRate(value) {
  const rate = toNumber(value);

  return rate === null ? '—' : `${rateFormatter.format(rate)} %`;
}

export function formatDate(value) {
  if (!value) return '—';

  const text = typeof value === 'string' ? value : '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(text) ? 'UTC' : undefined,
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
