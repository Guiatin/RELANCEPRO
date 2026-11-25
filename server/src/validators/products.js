import { z } from 'zod';

const BIGINT_UNSIGNED_MAX = '18446744073709551615';
const UNIT_PRICE_MAX = 999999999999;
const PRODUCT_TYPES = ['product', 'service'];

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Le nom du produit est requis.')
  .max(120, 'Le nom du produit ne doit pas dépasser 120 caractères.');

const unitPriceSchema = z
  .number({ message: 'Le prix unitaire doit être un nombre entier.' })
  .int('Le prix unitaire doit être un entier.')
  .min(0, 'Le prix unitaire doit être un entier positif ou nul.')
  .max(UNIT_PRICE_MAX, 'Le prix unitaire ne doit pas dépasser 999 999 999 999.');

const taxRateSchema = z
  .union([z.number().finite(), z.string()])
  .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
  .refine(
    (value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 100,
    'Le taux de TVA doit être compris entre 0 et 100 avec au maximum deux décimales.',
  );

const optionalFields = {
  description: z.string().nullable().optional(),
  unit: z
    .string()
    .trim()
    .max(20, "L'unité ne doit pas dépasser 20 caractères.")
    .nullable()
    .optional(),
  unit_price: unitPriceSchema.optional(),
  tax_rate: taxRateSchema.optional(),
  is_active: z.boolean().optional(),
};

export const createProductSchema = z
  .object({
    type: z.enum(PRODUCT_TYPES, { message: "Le type doit être 'product' ou 'service'." }),
    name: nameSchema,
    ...optionalFields,
  })
  .strict();

export const updateProductSchema = z
  .object({
    type: z
      .enum(PRODUCT_TYPES, { message: "Le type doit être 'product' ou 'service'." })
      .optional(),
    name: nameSchema.optional(),
    ...optionalFields,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Aucune modification fournie.',
  });

export const listProductsQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(190, 'La recherche ne doit pas dépasser 190 caractères.')
      .optional(),
    type: z
      .enum(PRODUCT_TYPES, { message: 'Le filtre type doit valoir product ou service.' })
      .optional(),
    active: z
      .enum(['true', 'false'], { message: 'Le filtre active doit valoir true ou false.' })
      .optional(),
    page: z.coerce.number().int('Page invalide.').min(1, 'Page invalide.').optional(),
    limit: z.coerce
      .number()
      .int('Limite invalide.')
      .min(1, 'Limite invalide.')
      .max(100, 'La limite maximale est 100.')
      .optional(),
  })
  .strict();

function isWithinBigIntUnsigned(value) {
  return value.length < 20 || (value.length === 20 && value <= BIGINT_UNSIGNED_MAX);
}

function isPositiveBigIntString(value) {
  if (!/^[1-9]\d*$/.test(value)) return false;

  return isWithinBigIntUnsigned(value);
}

export const productIdParamSchema = z
  .object({
    id: z.string().refine(isPositiveBigIntString, 'Identifiant invalide.'),
  })
  .strict();
