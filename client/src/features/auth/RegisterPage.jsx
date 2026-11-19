import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/layout/AuthShell.jsx';
import RecoveryCodeModal from '../../components/domain/RecoveryCodeModal.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import { useAuth } from '../../context/auth-context.js';
import { apiErrorMessage, apiFieldErrors, zodFieldErrors } from '../../lib/errors.js';
import { registerSchema } from './schemas.js';

const INITIAL_FORM = {
  company_name: '',
  full_name: '',
  email: '',
  password: '',
  confirm_password: '',
};

export default function RegisterPage() {
  const { register } = useAuth();
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

    const parsed = registerSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }

    setLoading(true);

    try {
      const data = await register({
        company_name: parsed.data.company_name,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (!data.recovery_code) {
        navigate('/app', { replace: true });
        return;
      }

      setRecovery({ code: data.recovery_code, email: data.user.email });
    } catch (error) {
      setGlobalError(apiErrorMessage(error, 'Impossible de créer le compte.'));
      setErrors(apiFieldErrors(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Créez votre espace entreprise"
      subtitle="Quelques informations suffisent. Votre espace est prêt immédiatement."
      footer={
        <p>
          Vous avez déjà un compte ?{' '}
          <Link to="/connexion" className="font-semibold text-brand-blue hover:underline">
            Se connecter
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <Alert variant="warning" title="Un code de récupération vous sera remis">
          Il sera affiché une seule fois à la fin de l’inscription. Conservez-le pour pouvoir
          réinitialiser votre mot de passe sans email.
        </Alert>

        {globalError && <Alert variant="error">{globalError}</Alert>}

        <Input
          label="Nom de l’entreprise"
          name="company_name"
          autoComplete="organization"
          placeholder="Acme SARL"
          value={form.company_name}
          onChange={(event) => update('company_name', event.target.value)}
          error={errors.company_name}
          required
        />

        <Input
          label="Votre nom complet"
          name="full_name"
          autoComplete="name"
          placeholder="Awa Traoré"
          value={form.full_name}
          onChange={(event) => update('full_name', event.target.value)}
          error={errors.full_name}
          required
        />

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

        <PasswordInput
          name="password"
          autoComplete="new-password"
          placeholder="Au moins 8 caractères"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          error={errors.password}
          hint="8 caractères minimum. Évitez les mots de passe courants."
          required
        />

        <PasswordInput
          label="Confirmer le mot de passe"
          name="confirm_password"
          autoComplete="new-password"
          placeholder="Répétez le mot de passe"
          value={form.confirm_password}
          onChange={(event) => update('confirm_password', event.target.value)}
          error={errors.confirm_password}
          required
        />

        <Button type="submit" className="w-full" isLoading={loading}>
          Créer mon espace
        </Button>
      </form>

      {recovery && (
        <RecoveryCodeModal
          code={recovery.code}
          email={recovery.email}
          onConfirm={() => navigate('/app', { replace: true })}
        />
      )}
    </AuthShell>
  );
}
