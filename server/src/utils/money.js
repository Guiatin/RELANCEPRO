export const MAX_AMOUNT = 999999999999;

const DECIMAL_SCALE = 100n;
const RATE_SCALE = 10000n;

export function toScaledDecimal(value, decimals = 2) {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim();

  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new TypeError(`Valeur décimale invalide : ${value}`);
  }

  const [integerPart, fractionPart = ''] = text.split('.');

  if (fractionPart.length > decimals) {
    throw new TypeError(`Valeur décimale trop précise : ${value}`);
  }

  const padded = fractionPart.padEnd(decimals, '0');

  return BigInt(integerPart) * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

function toIntegerBigInt(value) {
  if (typeof value === 'bigint') return value;

  const number = Number(value);

  if (!Number.isInteger(number)) {
    throw new TypeError(`Montant entier invalide : ${value}`);
  }

  return BigInt(number);
}

function roundHalfUp(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator;
}

export function computeLine({ quantity, unitPrice, discountRate = 0, taxRate = 0 }) {
  const quantityScaled = toScaledDecimal(quantity, 2);
  const unitPriceValue = toIntegerBigInt(unitPrice);
  const discountScaled = toScaledDecimal(discountRate, 2);
  const taxScaled = toScaledDecimal(taxRate, 2);

  const lineSubtotal = roundHalfUp(quantityScaled * unitPriceValue, DECIMAL_SCALE);
  const lineDiscount = roundHalfUp(lineSubtotal * discountScaled, RATE_SCALE);
  const base = lineSubtotal - lineDiscount;
  const lineTax = roundHalfUp(base * taxScaled, RATE_SCALE);
  const lineTotal = base + lineTax;

  return {
    lineSubtotal: Number(lineSubtotal),
    lineDiscount: Number(lineDiscount),
    lineTax: Number(lineTax),
    lineTotal: Number(lineTotal),
  };
}

export function computeTotals(lines) {
  let subtotal = 0n;
  let discountTotal = 0n;
  let taxTotal = 0n;
  let total = 0n;

  for (const line of lines) {
    subtotal += toIntegerBigInt(line.lineSubtotal);
    discountTotal += toIntegerBigInt(line.lineDiscount);
    taxTotal += toIntegerBigInt(line.lineTax);
    total += toIntegerBigInt(line.lineTotal);
  }

  return {
    subtotal: Number(subtotal),
    discountTotal: Number(discountTotal),
    taxTotal: Number(taxTotal),
    total: Number(total),
  };
}
