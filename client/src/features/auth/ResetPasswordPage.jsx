import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/layout/AuthShell.jsx';
import RecoveryCodeModal from '../../components/domain/RecoveryCodeModal.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import { api } from '../../lib/http.js';
import { apiErrorMessage, apiFieldErrors, zodFieldErrors } from '../../lib/errors.js';
import { resetPasswordSchema } from './schemas.js';

const INITIAL_FORM = {
  email: '',
  recovery_code: '',
  new_password: '',
  confirm_password: '',
};

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState(null);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setGlobalError('');
    setErrors({});

    const parsed = resetPasswordSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', {
        email: parsed.data.email,
        recovery_code: parsed.data.recovery_code,
        new_password: parsed.data.new_password,
      });

      setRecovery({
        code: response.data.data.recovery_code,
        email: parsed.data.email,
      });
    } catch (error) {
      setGlobalError(apiErrorMessage(error, 'Email ou code de récupération invalide.'));
      setErrors(apiFieldErrors(error));
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    navigate('/connexion', {
      replace: true,
      state: {
        message:
          'Mot de passe réinitialisé. Toutes les sessions ont été fermées, connectez-vous avec votre nouveau mot de passe.',
      },
    });
  }

  return (
    <AuthShell
      title="Réinitialiser votre accès"
      subtitle="Aucun email n’est envoyé : utilisez le code de récupération remis à l’inscription."
      footer={
        <p>
          Vous vous en souvenez finalement ?{' '}
          <Link to="/connexion" className="font-semibold text-brand-blue hover:underline">
            Revenir à la connexion
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <Alert variant="info">
          La réinitialisation ferme toutes les sessions ouvertes et remplace votre ancien code par
          un nouveau, affiché une seule fois.
        </Alert>

        {globalError && <Alert variant="error">{globalError}</Alert>}

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="vous@entreprise.bf"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          error={errors.email}
          required
        />

        <Input
          label="Code de récupération"
          name="recovery_code"
          autoComplete="off"
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          value={form.recovery_code}
          onChange={(event) => update('recovery_code', event.target.value)}
          error={errors.recovery_code}
          hint="Majuscules, minuscules et séparateurs sont acceptés."
          required
        />

        <PasswordInput
          label="Nouveau mot de passe"
          name="new_password"
          autoComplete="new-password"
          placeholder="Au moins 8 caractères"
          value={form.new_password}
          onChange={(event) => update('new_password', event.target.value)}
          error={errors.new_password}
          required
        />

        <PasswordInput
          label="Confirmer le nouveau mot de passe"
          name="confirm_password"
          autoComplete="new-password"
          placeholder="Répétez le mot de passe"
          value={form.confirm_password}
          onChange={(event) => update('confirm_password', event.target.value)}
          error={errors.confirm_password}
          required
        />

        <Button type="submit" className="w-full" isLoading={loading}>
          Réinitialiser et afficher mon nouveau code
        </Button>
      </form>

      {recovery && (
        <RecoveryCodeModal code={recovery.code} email={recovery.email} onConfirm={handleConfirm} />
      )}
    </AuthShell>
  );
}
