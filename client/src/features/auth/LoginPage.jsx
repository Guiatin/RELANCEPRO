import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/layout/AuthShell.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import { useAuth } from '../../context/auth-context.js';
import { apiErrorMessage, apiFieldErrors, zodFieldErrors } from '../../lib/errors.js';
import { loginSchema } from './schemas.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setGlobalError('');
    setErrors({});

    const parsed = loginSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }

    setLoading(true);

    try {
      await login(parsed.data);
      navigate(location.state?.from ?? '/app', { replace: true });
    } catch (error) {
      setGlobalError(apiErrorMessage(error, 'Email ou mot de passe incorrect.'));
      setErrors(apiFieldErrors(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Connectez-vous à votre espace"
      subtitle="Reprenez là où vous en étiez : devis, factures et relances."
      footer={
        <div className="space-y-3">
          <p>
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="font-semibold text-brand-blue hover:underline">
              Créer une entreprise
            </Link>
          </p>
          <p>
            Mot de passe oublié ?{' '}
            <Link
              to="/mot-de-passe-oublie"
              className="font-semibold text-brand-blue hover:underline"
            >
              Réinitialiser avec mon code
            </Link>
          </p>
        </div>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {location.state?.message && <Alert variant="success">{location.state.message}</Alert>}

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

        <PasswordInput
          name="password"
          autoComplete="current-password"
          placeholder="Votre mot de passe"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          error={errors.password}
          required
        />

        <Button type="submit" className="w-full" isLoading={loading}>
          Se connecter
        </Button>
      </form>
    </AuthShell>
  );
}
