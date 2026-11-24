import { z } from 'zod';

const optionalText = (max, message) => z.string().trim().max(max, message);

const optionalEmail = z
  .string()
  .trim()
  .max(190, "L'email ne doit pas dépasser 190 caractères.")
  .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Email invalide.');

export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom du client est requis.')
    .max(120, 'Le nom du client ne doit pas dépasser 120 caractères.'),
  contact_name: optionalText(120, 'Le nom du contact ne doit pas dépasser 120 caractères.'),
  email: optionalEmail,
  phone: optionalText(40, 'Le téléphone ne doit pas dépasser 40 caractères.'),
  whatsapp: optionalText(40, 'Le WhatsApp ne doit pas dépasser 40 caractères.'),
  address: optionalText(255, "L'adresse ne doit pas dépasser 255 caractères."),
  city: optionalText(80, 'La ville ne doit pas dépasser 80 caractères.'),
  notes: z.string(),
  is_active: z.boolean(),
});
