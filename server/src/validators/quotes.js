import { z } from 'zod';
import { validationError } from '../utils/errors.js';

const BIGINT_UNSIGNED_MAX = '18446744073709551615';
const MAX_AMOUNT = 999999999999;
const MAX_QUANTITY = 1000000;
const MAX_ITEMS = 200;

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'refused', 'converted'];
export const EXEMPTION_CODES = ['legal', 'export', 'special_regime', 'other'];

function isPositiveBigIntString(value) {
  if (!/^[1-9]\d*$/.test(value)) return false;

  return value.length < 20 || (value.length === 20 && value <= BIGINT_UNSIGNED_MAX);
}

const idSchema = z.string().refine(isPositiveBigIntString, 'Identifiant invalide.');

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date doit être au format AAAA-MM-JJ.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Date invalide.');

function decimalString({ min, max, label }) {
  return z
    .union([z.number().finite(), z.string()], { message: `${label} invalide.` })
    .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
    .superRefine((value, context) => {
      if (!/^\d+(\.\d{1,2})?$/.test(value)) {
        context.addIssue({
          code: 'custom',
          message: `${label} doit être un nombre avec au plus deux décimales.`,
        });
        return;
      }

      const number = Number(value);

      if (number < min || number > max) {
        context.addIssue({
          code: 'custom',
          message: `${label} doit être compris entre ${min} et ${max}.`,
        });
      }
    })
    .transform((value) => {
      const [integerPart, fractionPart = ''] = value.split('.');

      return `${integerPart}.${fractionPart.padEnd(2, '0')}`;
    });
}

const quantitySchema = decimalString({
  min: 0.01,
  max: MAX_QUANTITY,
  label: 'La quantité',
});

const rateSchema = decimalString({ min: 0, max: 100, label: 'Le taux' });

const unitPriceSchema = z
  .number({ message: 'Le prix unitaire doit être un nombre entier.' })
  .int('Le prix unitaire doit être un entier.')
  .min(0, 'Le prix unitaire doit être un entier positif ou nul.')
  .max(MAX_AMOUNT, 'Le prix unitaire ne doit pas dépasser 999 999 999 999.');

const optionalText = (max, message) => z.string().trim().max(max, message).nullable().optional();

const quoteItemSchema = z
  .object({
    product_id: idSchema.nullable().optional(),
    description: z
      .string()
      .trim()
      .min(1, 'La description de la ligne est requise.')
      .max(255, 'La description de la ligne ne doit pas dépasser 255 caractères.'),
    quantity: quantitySchema,
    unit: optionalText(20, "L'unité ne doit pas dépasser 20 caractères."),
    unit_price: unitPriceSchema,
    discount_rate: rateSchema.optional().default('0.00'),
    tax_rate: rateSchema,
    tax_exemption_code: z.enum(EXEMPTION_CODES).nullable().optional(),
    tax_exemption_reason: optionalText(
      150,
      "Le motif d'exonération ne doit pas dépasser 150 caractères.",
    ),
  })
  .strict()
  .superRefine((item, context) => {
    const rate = Number(item.tax_rate);
    const code = item.tax_exemption_code ?? null;
    const reason = item.tax_exemption_reason ?? null;

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
          message: 'Le motif est requis pour le code d’exonération « autre ».',
        });
      }

      if (code !== 'other' && reason) {
        context.addIssue({
          code: 'custom',
          path: ['tax_exemption_reason'],
          message: 'Le motif ne s’applique qu’au code d’exonération « autre ».',
        });
      }

      return;
    }

    if (code) {
      context.addIssue({
        code: 'custom',
        path: ['tax_exemption_code'],
        message: "Le code d'exonération n'est autorisé que lorsque la TVA est à 0.",
      });
    }

    if (reason) {
      context.addIssue({
        code: 'custom',
        path: ['tax_exemption_reason'],
        message: "Le motif d'exonération n'est autorisé que lorsque la TVA est à 0.",
      });
    }
  });

const headerFields = {
  notes: optionalText(5000, 'Les notes ne doivent pas dépasser 5000 caractères.'),
  terms: optionalText(5000, 'Les conditions ne doivent pas dépasser 5000 caractères.'),
  client_reference: optionalText(100, 'La référence client ne doit pas dépasser 100 caractères.'),
  valid_until: dateSchema.nullable().optional(),
};

const itemsSchema = z.array(quoteItemSchema).max(MAX_ITEMS, 'Trop de lignes (200 maximum).');

export const createQuoteSchema = z
  .object({
    client_id: idSchema,
    ...headerFields,
    items: itemsSchema.optional(),
  })
  .strict();

export const updateQuoteSchema = z
  .object({
    client_id: idSchema.optional(),
    ...headerFields,
    items: itemsSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Aucune modification fournie.',
  });

export const quoteStatusSchema = z
  .object({
    status: z.enum(['accepted', 'refused'], {
      message: 'Le statut doit valoir accepted ou refused.',
    }),
  })
  .strict();

export const listQuotesQuerySchema = z
  .object({
    status: z.enum(QUOTE_STATUSES, { message: 'Statut de devis invalide.' }).optional(),
    client_id: idSchema.optional(),
    reference: z
      .string()
      .trim()
      .max(100, 'La référence ne doit pas dépasser 100 caractères.')
      .optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    page: z.coerce.number().int('Page invalide.').min(1, 'Page invalide.').optional(),
    limit: z.coerce
      .number()
      .int('Limite invalide.')
      .min(1, 'Limite invalide.')
      .max(100, 'La limite maximale est 100.')
      .optional(),
  })
  .strict();

export const quoteIdParamSchema = z
  .object({
    id: z.string().refine(isPositiveBigIntString, 'Identifiant invalide.'),
  })
  .strict();

function toValidationDetails(error) {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
      return issue.keys.map((key) => ({ field: key, message: 'Champ non autorisé.' }));
    }

    return [{ field: issue.path.join('.'), message: issue.message }];
  });
}

export function parseCreateQuote(data) {
  const result = createQuoteSchema.safeParse(data);

  if (!result.success) throw validationError(toValidationDetails(result.error));

  return result.data;
}

export function parseUpdateQuote(data) {
  const result = updateQuoteSchema.safeParse(data);

  if (!result.success) throw validationError(toValidationDetails(result.error));

  return result.data;
}
