import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import RecoveryCodeModal from '../../components/domain/RecoveryCodeModal.jsx';
import { useAuth } from '../../context/auth-context.js';
import { api } from '../../lib/http.js';
import { apiErrorMessage, apiFieldErrors, zodFieldErrors } from '../../lib/errors.js';
import { changePasswordSchema } from '../auth/schemas.js';

const INITIAL_PASSWORD_FORM = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

export default function SecurityPage() {
  const { user } = useAuth();
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [newRecoveryCode, setNewRecoveryCode] = useState(null);

  function updatePassword(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    setPasswordErrors({});

    const parsed = changePasswordSchema.safeParse(passwordForm);

    if (!parsed.success) {
      setPasswordErrors(zodFieldErrors(parsed.error));
      return;
    }

    setPasswordLoading(true);

    try {
      await api.patch('/auth/password', {
        current_password: parsed.data.current_password,
        new_password: parsed.data.new_password,
      });

      setPasswordForm(INITIAL_PASSWORD_FORM);
      setPasswordMessage('Mot de passe mis à jour. Les autres sessions ont été fermées.');
    } catch (error) {
      setPasswordError(apiErrorMessage(error, 'Impossible de modifier le mot de passe.'));
      setPasswordErrors(apiFieldErrors(error));
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleRegenerate(event) {
    event.preventDefault();
    setRecoveryError('');
    setRecoveryMessage('');

    if (!recoveryPassword) {
      setRecoveryError('Mot de passe requis.');
      return;
    }

    setRecoveryLoading(true);

    try {
      const response = await api.post('/auth/recovery-code/regenerate', {
        password: recoveryPassword,
      });

      setNewRecoveryCode(response.data.data.recovery_code);
      setRecoveryPassword('');
    } catch (error) {
      setRecoveryError(apiErrorMessage(error, 'Impossible de régénérer le code.'));
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
          Paramètres
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          Sécurité du compte
        </h1>
        <p className="mt-2 text-sm text-muted">
          Connecté avec {user?.email}. Ces actions protègent l’accès à votre entreprise.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-blue">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-navy">Changer le mot de passe</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Les autres sessions seront fermées. Votre session actuelle reste active.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit} noValidate>
            {passwordMessage && <Alert variant="success">{passwordMessage}</Alert>}
            {passwordError && <Alert variant="error">{passwordError}</Alert>}

            <PasswordInput
              label="Mot de passe actuel"
              name="current_password"
              autoComplete="current-password"
              value={passwordForm.current_password}
              onChange={(event) => updatePassword('current_password', event.target.value)}
              error={passwordErrors.current_password}
              required
            />

            <PasswordInput
              label="Nouveau mot de passe"
              name="new_password"
              autoComplete="new-password"
              value={passwordForm.new_password}
              onChange={(event) => updatePassword('new_password', event.target.value)}
              error={passwordErrors.new_password}
              hint="8 caractères minimum."
              required
            />

            <PasswordInput
              label="Confirmer le nouveau mot de passe"
              name="confirm_password"
              autoComplete="new-password"
              value={passwordForm.confirm_password}
              onChange={(event) => updatePassword('confirm_password', event.target.value)}
              error={passwordErrors.confirm_password}
              required
            />

            <Button type="submit" isLoading={passwordLoading}>
              Mettre à jour le mot de passe
            </Button>
          </form>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-navy">Régénérer le code de récupération</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                L’ancien code sera immédiatement révoqué. Le nouveau ne sera affiché qu’une seule
                fois.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleRegenerate} noValidate>
            {recoveryMessage && <Alert variant="success">{recoveryMessage}</Alert>}
            {recoveryError && <Alert variant="error">{recoveryError}</Alert>}

            <PasswordInput
              label="Mot de passe actuel"
              name="recovery_password"
              autoComplete="current-password"
              value={recoveryPassword}
              onChange={(event) => setRecoveryPassword(event.target.value)}
              error={recoveryError === 'Mot de passe requis.' ? recoveryError : undefined}
              hint="Requis pour confirmer la régénération."
              required
            />

            <Button type="submit" variant="secondary" isLoading={recoveryLoading}>
              Régénérer et afficher le nouveau code
            </Button>
          </form>
        </Card>
      </div>

      {newRecoveryCode && (
        <RecoveryCodeModal
          code={newRecoveryCode}
          email={user?.email}
          onConfirm={() => {
            setNewRecoveryCode(null);
            setRecoveryMessage('Nouveau code de récupération généré. L’ancien code est révoqué.');
          }}
        />
      )}
    </div>
  );
}
