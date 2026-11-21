import { z } from 'zod';

const BIGINT_UNSIGNED_MAX = '18446744073709551615';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Le nom du client est requis.')
  .max(120, 'Le nom du client ne doit pas dépasser 120 caractères.');

const optionalFields = {
  contact_name: z
    .string()
    .trim()
    .max(120, 'Le nom du contact ne doit pas dépasser 120 caractères.')
    .optional(),
  email: z
    .string()
    .trim()
    .max(190, "L'email ne doit pas dépasser 190 caractères.")
    .email('Email invalide.')
    .optional(),
  phone: z.string().trim().max(40, 'Le téléphone ne doit pas dépasser 40 caractères.').optional(),
  whatsapp: z.string().trim().max(40, 'Le WhatsApp ne doit pas dépasser 40 caractères.').optional(),
  address: z.string().trim().max(255, "L'adresse ne doit pas dépasser 255 caractères.").optional(),
  city: z.string().trim().max(80, 'La ville ne doit pas dépasser 80 caractères.').optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
};

export const createClientSchema = z
  .object({
    name: nameSchema,
    ...optionalFields,
  })
  .strict();

export const updateClientSchema = z
  .object({
    name: nameSchema.optional(),
    ...optionalFields,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Aucune modification fournie.',
  });

export const listClientsQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(190, 'La recherche ne doit pas dépasser 190 caractères.')
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

function isPositiveBigIntString(value) {
  if (!/^[1-9]\d*$/.test(value)) return false;

  return value.length < 20 || (value.length === 20 && value <= BIGINT_UNSIGNED_MAX);
}

export const clientIdParamSchema = z
  .object({
    id: z.string().refine(isPositiveBigIntString, 'Identifiant invalide.'),
  })
  .strict();
