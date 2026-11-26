import { z } from 'zod';

export const QUOTE_STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyé' },
  { value: 'accepted', label: 'Accepté' },
  { value: 'refused', label: 'Refusé' },
  { value: 'converted', label: 'Converti' },
];

export const QUOTE_STATUS_LABELS = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  converted: 'Converti',
};

export const QUOTE_STATUS_VARIANTS = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  refused: 'danger',
  converted: 'info',
};

export const EXEMPTION_CODE_OPTIONS = [
  { value: '', label: 'Aucune exonération' },
  { value: 'legal', label: 'Exonération légale' },
  { value: 'export', label: 'Exportation' },
  { value: 'special_regime', label: 'Régime particulier' },
  { value: 'other', label: 'Autre' },
];

export const EXEMPTION_CODE_LABELS = {
  legal: 'Exonération légale',
  export: 'Exportation',
  special_regime: 'Régime particulier',
  other: 'Autre',
};

export const EMPTY_QUOTE_ITEM = {
  product_id: '',
  description: '',
  quantity: '1',
  unit: '',
  unit_price: '',
  discount_rate: '0',
  tax_rate: '18',
  tax_exemption_code: '',
  tax_exemption_reason: '',
};

const MAX_AMOUNT = 999999999999;
const INTEGER_PATTERN = /^(0|[1-9]\d*)$/;
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

function exemptionIssues(item, context) {
  const rate = Number(item.tax_rate);
  const code = item.tax_exemption_code;
  const reason = item.tax_exemption_reason.trim();

  if (rate === 0) {
    if (!code) {
      context.addIssue({
        code: 'custom',
        path: ['tax_exemption_code'],
        message: "Un code d'exonération est requis lorsque la TVA est à 0.",
      });
      return;
    }

    if (code === 'other' && !reason) {
      context.addIssue({
        code: 'custom',
        path: ['tax_exemption_reason'],
        message: 'Le motif est requis pour le code « autre ».',
      });
    }

    if (code !== 'other' && reason) {
      context.addIssue({
        code: 'custom',
        path: ['tax_exemption_reason'],
        message: 'Le motif ne s’applique qu’au code « autre ».',
      });
    }

    return;
  }

  if (code) {
    context.addIssue({
      code: 'custom',
      path: ['tax_exemption_code'],
      message: "Le code d'exonération n'est autorisé que si la TVA est à 0.",
    });
  }
}

export const quoteItemSchema = z
  .object({
    product_id: z.string(),
    description: z
      .string()
      .trim()
      .min(1, 'La description de la ligne est requise.')
      .max(255, 'La description ne doit pas dépasser 255 caractères.'),
    quantity: z
      .string()
      .trim()
      .refine(
        (value) => DECIMAL_PATTERN.test(value) && Number(value) > 0 && Number(value) <= 1000000,
        'La quantité doit être un nombre positif (deux décimales maximum).',
      ),
    unit: z.string().trim().max(20, "L'unité ne doit pas dépasser 20 caractères."),
    unit_price: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || INTEGER_PATTERN.test(value),
        'Le prix unitaire doit être un entier positif (FCFA).',
      )
      .refine(
        (value) => value === '' || Number(value) <= MAX_AMOUNT,
        'Le prix unitaire ne doit pas dépasser 999 999 999 999.',
      ),
    discount_rate: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || (DECIMAL_PATTERN.test(value) && Number(value) <= 100),
        'La remise doit être comprise entre 0 et 100.',
      ),
    tax_rate: z
      .string()
      .trim()
      .refine(
        (value) => DECIMAL_PATTERN.test(value) && Number(value) <= 100,
        'La TVA doit être comprise entre 0 et 100.',
      ),
    tax_exemption_code: z.string(),
    tax_exemption_reason: z
      .string()
      .trim()
      .max(150, "Le motif d'exonération ne doit pas dépasser 150 caractères."),
  })
  .superRefine(exemptionIssues);

export const quoteFormSchema = z.object({
  client_id: z.string().min(1, 'Sélectionnez un client.'),
  client_reference: z
    .string()
    .trim()
    .max(100, 'La référence client ne doit pas dépasser 100 caractères.'),
  valid_until: z
    .string()
    .refine(
      (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'La date doit être au format AAAA-MM-JJ.',
    ),
  notes: z.string().max(5000, 'Les notes ne doivent pas dépasser 5000 caractères.'),
  terms: z.string().max(5000, 'Les conditions ne doivent pas dépasser 5000 caractères.'),
  items: z.array(quoteItemSchema),
});

export function toQuotePayload(form) {
  return {
    client_id: form.client_id,
    client_reference: form.client_reference.trim() || null,
    valid_until: form.valid_until || null,
    notes: form.notes.trim() || null,
    terms: form.terms.trim() || null,
    items: form.items.map((item) => {
      const rate = Number(item.tax_rate);

      return {
        product_id: item.product_id || null,
        description: item.description.trim(),
        quantity: item.quantity.trim(),
        unit: item.unit.trim() || null,
        unit_price: Number(item.unit_price.trim() || '0'),
        discount_rate: item.discount_rate.trim() || '0',
        tax_rate: item.tax_rate.trim(),
        tax_exemption_code: rate === 0 ? item.tax_exemption_code || null : null,
        tax_exemption_reason:
          rate === 0 && item.tax_exemption_code === 'other'
            ? item.tax_exemption_reason.trim() || null
            : null,
      };
    }),
  };
}

export function previewLine(item) {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const discountRate = Number(item.discount_rate) || 0;
  const taxRate = Number(item.tax_rate) || 0;

  const subtotal = Math.round(quantity * unitPrice);
  const discount = Math.round((subtotal * discountRate) / 100);
  const base = subtotal - discount;
  const tax = Math.round((base * taxRate) / 100);

  return { subtotal, discount, tax, total: base + tax };
}
