import { z } from 'zod';
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '../config/constants.js';
import { isValidRecoveryCode, normalizeRecoveryCode } from '../utils/crypto.js';

const WEAK_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '00000000',
  'password',
  'password1',
  'motdepasse',
  'qwerty123',
  'admin123',
  'relancepro',
  'iloveyou',
]);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(190, 'Email trop long.')
  .email('Email invalide.');

const passwordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  )
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES,
    `Le mot de passe ne doit pas dépasser ${MAX_PASSWORD_BYTES} octets.`,
  )
  .refine((value) => !WEAK_PASSWORDS.has(value.toLowerCase()), 'Ce mot de passe est trop courant.');

const recoveryCodeSchema = z
  .string()
  .trim()
  .min(1, 'Code de récupération requis.')
  .transform(normalizeRecoveryCode)
  .refine(isValidRecoveryCode, 'Code de récupération invalide.');

export const registerSchema = z
  .object({
    company_name: z.string().trim().min(2, "Le nom de l'entreprise est requis.").max(120),
    full_name: z.string().trim().min(2, 'Le nom complet est requis.').max(120),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Mot de passe requis.').max(MAX_PASSWORD_BYTES),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    recovery_code: recoveryCodeSchema,
    new_password: passwordSchema,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Mot de passe actuel requis.').max(MAX_PASSWORD_BYTES),
    new_password: passwordSchema,
  })
  .strict();

export const regenerateRecoveryCodeSchema = z
  .object({
    password: z.string().min(1, 'Mot de passe requis.').max(MAX_PASSWORD_BYTES),
  })
  .strict();
