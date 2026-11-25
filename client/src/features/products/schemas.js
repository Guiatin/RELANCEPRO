import { z } from 'zod';

export const PRODUCT_TYPE_OPTIONS = [
  { value: 'product', label: 'Produit' },
  { value: 'service', label: 'Service' },
];

const UNIT_PRICE_MAX = 999999999999;
const INTEGER_PATTERN = /^(0|[1-9]\d*)$/;

const optionalText = (max, message) => z.string().trim().max(max, message);

export const productSchema = z.object({
  type: z.enum(['product', 'service'], { message: "Le type doit être 'product' ou 'service'." }),
  name: z
    .string()
    .trim()
    .min(1, 'Le nom du produit est requis.')
    .max(120, 'Le nom du produit ne doit pas dépasser 120 caractères.'),
  description: optionalText(2000, 'La description ne doit pas dépasser 2000 caractères.'),
  unit: optionalText(20, "L'unité ne doit pas dépasser 20 caractères."),
  unit_price: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || INTEGER_PATTERN.test(value),
      'Le prix unitaire doit être un entier positif ou nul (FCFA).',
    )
    .transform((value) => (value === '' ? 0 : Number(value)))
    .refine(
      (value) => value <= UNIT_PRICE_MAX,
      'Le prix unitaire ne doit pas dépasser 999 999 999 999.',
    ),
  tax_rate: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 100),
      'Le taux de TVA doit être compris entre 0 et 100 avec au maximum deux décimales.',
    ),
  is_active: z.boolean(),
});
