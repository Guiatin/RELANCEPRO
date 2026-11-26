import { describe, expect, it } from 'vitest';
import { computeLine, computeTotals, toScaledDecimal } from '../src/utils/money.js';

describe('computeLine', () => {
  it('calcule une ligne sans remise ni exonération', () => {
    expect(computeLine({ quantity: '2.00', unitPrice: 1000, taxRate: '18.00' })).toEqual({
      lineSubtotal: 2000,
      lineDiscount: 0,
      lineTax: 360,
      lineTotal: 2360,
    });
  });

  it('applique une remise avant la TVA', () => {
    expect(
      computeLine({
        quantity: 1,
        unitPrice: 1000,
        discountRate: '10.00',
        taxRate: '18.00',
      }),
    ).toEqual({
      lineSubtotal: 1000,
      lineDiscount: 100,
      lineTax: 162,
      lineTotal: 1062,
    });
  });

  it('arrondit au plus proche, demi vers le haut', () => {
    expect(computeLine({ quantity: 1, unitPrice: 1, discountRate: 0, taxRate: '50.00' })).toEqual({
      lineSubtotal: 1,
      lineDiscount: 0,
      lineTax: 1,
      lineTotal: 2,
    });

    expect(computeLine({ quantity: 1, unitPrice: 1, discountRate: '50.00', taxRate: 0 })).toEqual({
      lineSubtotal: 1,
      lineDiscount: 1,
      lineTax: 0,
      lineTotal: 0,
    });
  });

  it('gère une quantité décimale', () => {
    expect(computeLine({ quantity: '1.50', unitPrice: 1000, taxRate: '18.00' })).toEqual({
      lineSubtotal: 1500,
      lineDiscount: 0,
      lineTax: 270,
      lineTotal: 1770,
    });
  });

  it('reste précis sur les gros montants sans flottants', () => {
    expect(computeLine({ quantity: 1, unitPrice: 999999999999, taxRate: '18.00' })).toEqual({
      lineSubtotal: 999999999999,
      lineDiscount: 0,
      lineTax: 180000000000,
      lineTotal: 1179999999999,
    });
  });

  it('refuse les décimales invalides', () => {
    expect(() => toScaledDecimal('1.234')).toThrow(TypeError);
    expect(() => toScaledDecimal('-1')).toThrow(TypeError);
    expect(() => toScaledDecimal('abc')).toThrow(TypeError);
  });
});

describe('computeTotals', () => {
  it('additionne les lignes', () => {
    expect(
      computeTotals([
        { lineSubtotal: 2000, lineDiscount: 100, lineTax: 342, lineTotal: 2242 },
        { lineSubtotal: 1000, lineDiscount: 0, lineTax: 180, lineTotal: 1180 },
      ]),
    ).toEqual({
      subtotal: 3000,
      discountTotal: 100,
      taxTotal: 522,
      total: 3422,
    });
  });

  it('renvoie zéro sans ligne', () => {
    expect(computeTotals([])).toEqual({
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
    });
  });
});
