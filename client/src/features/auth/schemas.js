import { z } from 'zod';
import { isValidRecoveryCode, normalizeRecoveryCode } from '../../lib/recoveryCode.js';

const email = z.string().trim().toLowerCase().max(190, 'Email trop long.').email('Email invalide.');

const password = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Le mot de passe ne doit pas dépasser 72 octets.',
  );

const recoveryCode = z
  .string()
  .trim()
  .min(1, 'Code de récupération requis.')
  .transform(normalizeRecoveryCode)
  .refine(isValidRecoveryCode, 'Code de récupération invalide.');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis.'),
});

export const registerSchema = z
  .object({
    company_name: z.string().trim().min(2, "Le nom de l'entreprise est requis.").max(120),
    full_name: z.string().trim().min(2, 'Le nom complet est requis.').max(120),
    email,
    password,
    confirm_password: z.string().min(1, 'Confirmez le mot de passe.'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirm_password'],
  });

export const resetPasswordSchema = z
  .object({
    email,
    recovery_code: recoveryCode,
    new_password: password,
    confirm_password: z.string().min(1, 'Confirmez le mot de passe.'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirm_password'],
  });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Mot de passe actuel requis.'),
    new_password: password,
    confirm_password: z.string().min(1, 'Confirmez le mot de passe.'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirm_password'],
  });
