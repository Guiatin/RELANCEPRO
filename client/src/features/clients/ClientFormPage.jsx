import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { apiErrorMessage, apiFieldErrors, zodFieldErrors } from '../../lib/errors.js';
import { createClient, getClient, updateClient } from './api.js';
import { clientSchema } from './schemas.js';

const INITIAL_FORM = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  whatsapp: '',
  address: '',
  city: '',
  notes: '',
  is_active: true,
};

const PAYLOAD_FIELDS = ['contact_name', 'email', 'phone', 'whatsapp', 'address', 'city', 'notes'];

function toForm(client) {
  return {
    name: client.name ?? '',
    contact_name: client.contactName ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    whatsapp: client.whatsapp ?? '',
    address: client.address ?? '',
    city: client.city ?? '',
    notes: client.notes ?? '',
    is_active: Boolean(client.isActive),
  };
}

function toPayload(data) {
  const payload = { name: data.name, is_active: data.is_active };

  for (const field of PAYLOAD_FIELDS) {
    if (data[field] !== undefined && data[field] !== '') {
      payload[field] = data[field];
    }
  }

  return payload;
}

export default function ClientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [load, setLoad] = useState({
    id: null,
    status: isEdit ? 'loading' : 'success',
    error: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return undefined;

    let active = true;

    getClient(id)
      .then((client) => {
        if (!active) return;

        setForm(toForm(client));
        setLoad({ id, status: 'success', error: '' });
      })
      .catch((requestError) => {
        if (!active) return;

        setLoad({
          id,
          status: 'error',
          error: apiErrorMessage(requestError, 'Impossible de charger ce client.'),
        });
      });

    return () => {
      active = false;
    };
  }, [id]);

  const loading = isEdit && load.id !== id;
  const loadError = isEdit && load.id === id ? load.error : '';

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setGlobalError('');
    setErrors({});

    const parsed = clientSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    setSubmitting(true);

    try {
      const payload = toPayload(parsed.data);
      const client = isEdit ? await updateClient(id, payload) : await createClient(payload);

      navigate(`/app/clients/${client.id}`, {
        replace: true,
        state: { flash: isEdit ? 'Client mis à jour.' : 'Client créé.' },
      });
    } catch (requestError) {
      setGlobalError(apiErrorMessage(requestError, 'Impossible d’enregistrer ce client.'));
      setErrors(apiFieldErrors(requestError));
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  const backTo = isEdit ? `/app/clients/${id}` : '/app/clients';

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-navy"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {isEdit ? 'Retour à la fiche' : 'Retour aux clients'}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          {isEdit ? 'Modifier le client' : 'Nouveau client'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isEdit
            ? 'Mettez à jour les informations de la fiche client.'
            : 'Renseignez les informations du client pour le retrouver dans vos documents.'}
        </p>
      </div>

      {isEdit && loading && (
        <Card className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Chargement de la fiche…
        </Card>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {!loading && !loadError && (
        <Card>
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {globalError && <Alert variant="error">{globalError}</Alert>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  id="name"
                  label="Nom du client *"
                  name="name"
                  autoComplete="organization"
                  placeholder="Acme SARL"
                  value={form.name}
                  onChange={(event) => update('name', event.target.value)}
                  error={errors.name}
                  required
                />
              </div>

              <Input
                id="contact_name"
                label="Contact"
                name="contact_name"
                autoComplete="name"
                placeholder="Awa Traoré"
                value={form.contact_name}
                onChange={(event) => update('contact_name', event.target.value)}
                error={errors.contact_name}
              />

              <Input
                id="email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="contact@entreprise.bf"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                error={errors.email}
              />

              <Input
                id="phone"
                label="Téléphone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+226 70 00 00 00"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                error={errors.phone}
              />

              <Input
                id="whatsapp"
                label="WhatsApp"
                name="whatsapp"
                type="tel"
                autoComplete="tel"
                placeholder="+226 70 00 00 00"
                value={form.whatsapp}
                onChange={(event) => update('whatsapp', event.target.value)}
                error={errors.whatsapp}
              />

              <div className="sm:col-span-2">
                <Input
                  id="address"
                  label="Adresse"
                  name="address"
                  autoComplete="street-address"
                  placeholder="Rue 12, secteur 4"
                  value={form.address}
                  onChange={(event) => update('address', event.target.value)}
                  error={errors.address}
                />
              </div>

              <Input
                id="city"
                label="Ville"
                name="city"
                autoComplete="address-level2"
                placeholder="Ouagadougou"
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                error={errors.city}
              />
            </div>

            <Textarea
              id="notes"
              label="Notes"
              name="notes"
              placeholder="Informations utiles, conditions particulières…"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              error={errors.notes}
              rows={4}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => update('is_active', event.target.checked)}
                className="mt-0.5 size-4 rounded border-line text-brand-blue focus:ring-brand-blue"
              />
              <span>
                <span className="block font-medium text-navy">Client actif</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  Un client inactif reste consultable mais n’est pas proposé lors de la création de
                  documents.
                </span>
              </span>
            </label>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <Link
                to={backTo}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
              >
                Annuler
              </Link>
              <Button type="submit" isLoading={submitting}>
                {isEdit ? 'Enregistrer les modifications' : 'Créer le client'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
