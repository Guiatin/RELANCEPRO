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

export function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
