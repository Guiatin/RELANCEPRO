import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { apiErrorMessage, apiFieldErrors, zodFieldErrors } from '../../lib/errors.js';
import { createProduct, getProduct, updateProduct } from './api.js';
import { PRODUCT_TYPE_OPTIONS, productSchema } from './schemas.js';

const INITIAL_FORM = {
  type: 'product',
  name: '',
  description: '',
  unit: '',
  unit_price: '',
  tax_rate: '18',
  is_active: true,
};

function toForm(product) {
  return {
    type: product.type ?? 'product',
    name: product.name ?? '',
    description: product.description ?? '',
    unit: product.unit ?? '',
    unit_price: product.unitPrice != null ? String(product.unitPrice) : '',
    tax_rate: product.taxRate != null ? String(product.taxRate) : '',
    is_active: Boolean(product.isActive),
  };
}

function toPayload(data) {
  const payload = {
    type: data.type,
    name: data.name,
    description: data.description || null,
    unit: data.unit || null,
    unit_price: data.unit_price,
  };

  if (data.tax_rate !== '') payload.tax_rate = data.tax_rate;
  payload.is_active = data.is_active;

  return payload;
}

export default function ProductFormPage() {
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

    getProduct(id)
      .then((product) => {
        if (!active) return;

        setForm(toForm(product));
        setLoad({ id, status: 'success', error: '' });
      })
      .catch((requestError) => {
        if (!active) return;

        setLoad({
          id,
          status: 'error',
          error: apiErrorMessage(requestError, 'Impossible de charger ce produit.'),
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

    const parsed = productSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    setSubmitting(true);

    try {
      const payload = toPayload(parsed.data);
      const product = isEdit ? await updateProduct(id, payload) : await createProduct(payload);

      navigate(`/app/products/${product.id}`, {
        replace: true,
        state: { flash: isEdit ? 'Produit mis à jour.' : 'Produit créé.' },
      });
    } catch (requestError) {
      setGlobalError(apiErrorMessage(requestError, 'Impossible d’enregistrer ce produit.'));
      setErrors(apiFieldErrors(requestError));
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  const backTo = isEdit ? `/app/products/${id}` : '/app/products';

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-navy"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {isEdit ? 'Retour à la fiche' : 'Retour aux produits'}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          {isEdit ? 'Modifier le produit' : 'Nouveau produit'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isEdit
            ? 'Mettez à jour les informations du produit ou du service.'
            : 'Renseignez le produit ou le service pour le proposer dans vos documents.'}
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
              <Select
                id="type"
                label="Type *"
                name="type"
                options={PRODUCT_TYPE_OPTIONS}
                value={form.type}
                onChange={(event) => update('type', event.target.value)}
                error={errors.type}
              />

              <Input
                id="unit"
                label="Unité"
                name="unit"
                placeholder="pièce, kg, heure…"
                value={form.unit}
                onChange={(event) => update('unit', event.target.value)}
                error={errors.unit}
              />

              <div className="sm:col-span-2">
                <Input
                  id="name"
                  label="Nom *"
                  name="name"
                  autoComplete="off"
                  placeholder="Chaise en bois"
                  value={form.name}
                  onChange={(event) => update('name', event.target.value)}
                  error={errors.name}
                  required
                />
              </div>

              <Input
                id="unit_price"
                label="Prix unitaire (FCFA)"
                name="unit_price"
                inputMode="numeric"
                placeholder="0"
                hint="Montant en FCFA, entier positif."
                value={form.unit_price}
                onChange={(event) => update('unit_price', event.target.value)}
                error={errors.unit_price}
              />

              <Input
                id="tax_rate"
                label="Taux de TVA (%)"
                name="tax_rate"
                inputMode="decimal"
                placeholder="18"
                hint="Taux appliqué par défaut, de 0 à 100."
                value={form.tax_rate}
                onChange={(event) => update('tax_rate', event.target.value)}
                error={errors.tax_rate}
              />
            </div>

            <Textarea
              id="description"
              label="Description"
              name="description"
              placeholder="Caractéristiques, détails du service…"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              error={errors.description}
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
                <span className="block font-medium text-navy">Produit actif</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  Un produit inactif reste consultable mais n’est pas proposé lors de la création de
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
                {isEdit ? 'Enregistrer les modifications' : 'Créer le produit'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
