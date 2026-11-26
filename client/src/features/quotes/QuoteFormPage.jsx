import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import QuoteLineItemsEditor from '../../components/domain/QuoteLineItemsEditor.jsx';
import { listClients } from '../clients/api.js';
import { listProducts } from '../products/api.js';
import { apiErrorMessage } from '../../lib/errors.js';
import { formatAmount } from '../../lib/format.js';
import { createQuote, getQuote, updateQuote } from './api.js';
import { quoteFormSchema, previewLine, toQuotePayload } from './schemas.js';

const INITIAL_FORM = {
  client_id: '',
  client_reference: '',
  valid_until: '',
  notes: '',
  terms: '',
  items: [],
};

function toForm(quote) {
  return {
    client_id: quote.clientId,
    client_reference: quote.clientReference ?? '',
    valid_until: quote.validUntil ?? '',
    notes: quote.notes ?? '',
    terms: quote.terms ?? '',
    items: (quote.items ?? []).map((item) => ({
      product_id: item.productId ?? '',
      description: item.description,
      quantity: String(Number(item.quantity)),
      unit: item.unit ?? '',
      unit_price: String(item.unitPrice ?? ''),
      discount_rate: String(Number(item.discountRate ?? 0)),
      tax_rate: String(Number(item.taxRate ?? 0)),
      tax_exemption_code: item.taxExemptionCode ?? '',
      tax_exemption_reason: item.taxExemptionReason ?? '',
    })),
  };
}

function collectErrors(error) {
  const header = {};
  const items = {};

  for (const issue of error.issues) {
    if (issue.path[0] === 'items' && typeof issue.path[1] === 'number') {
      const index = issue.path[1];
      const field = issue.path[2] ?? 'items';
      items[index] = { ...(items[index] ?? {}), [field]: issue.message };
    } else {
      const field = issue.path[0];
      if (field && !header[field]) header[field] = issue.message;
    }
  }

  return { header, items };
}

export default function QuoteFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({ header: {}, items: {} });
  const [globalError, setGlobalError] = useState('');
  const [quote, setQuote] = useState(null);
  const [load, setLoad] = useState({
    id: null,
    status: isEdit ? 'loading' : 'success',
    error: '',
  });
  const [references, setReferences] = useState({ clients: [], products: [], loading: true });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      listClients({ active: 'true', limit: 100 }),
      listProducts({ active: 'true', limit: 100 }),
    ])
      .then(([clientsPayload, productsPayload]) => {
        if (!active) return;

        setReferences({
          clients: clientsPayload.data,
          products: productsPayload.data,
          loading: false,
        });
      })
      .catch(() => {
        if (!active) return;

        setReferences({ clients: [], products: [], loading: false });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return undefined;

    let active = true;

    getQuote(id)
      .then((data) => {
        if (!active) return;

        setQuote(data);
        setForm(toForm(data));
        setLoad({ id, status: 'success', error: '' });
      })
      .catch((requestError) => {
        if (!active) return;

        setLoad({
          id,
          status: 'error',
          error: apiErrorMessage(requestError, 'Impossible de charger ce devis.'),
        });
      });

    return () => {
      active = false;
    };
  }, [id]);

  const loading = isEdit && load.id !== id;
  const loadError = isEdit && load.id === id ? load.error : '';
  const locked = Boolean(isEdit && quote && quote.status !== 'draft');

  function updateHeader(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, header: { ...current.header, [field]: undefined } }));
  }

  const totals = form.items.reduce(
    (accumulator, item) => {
      const line = previewLine(item);

      return {
        subtotal: accumulator.subtotal + line.subtotal,
        discountTotal: accumulator.discountTotal + line.discount,
        taxTotal: accumulator.taxTotal + line.tax,
        total: accumulator.total + line.total,
      };
    },
    { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 },
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setGlobalError('');
    setErrors({ header: {}, items: {} });

    const parsed = quoteFormSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(collectErrors(parsed.error));
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    setSubmitting(true);

    try {
      const payload = toQuotePayload(parsed.data);
      const saved = isEdit ? await updateQuote(id, payload) : await createQuote(payload);

      navigate(`/app/quotes/${saved.id}`, {
        replace: true,
        state: { flash: isEdit ? 'Devis mis à jour.' : 'Devis créé.' },
      });
    } catch (requestError) {
      setGlobalError(apiErrorMessage(requestError, 'Impossible d’enregistrer ce devis.'));
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  const backTo = isEdit ? `/app/quotes/${id}` : '/app/quotes';
  const clientOptions = [
    { value: '', label: references.loading ? 'Chargement…' : 'Sélectionner un client' },
    ...references.clients.map((client) => ({ value: client.id, label: client.name })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-navy"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {isEdit ? 'Retour au devis' : 'Retour aux devis'}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          {isEdit ? 'Modifier le devis' : 'Nouveau devis'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Le numéro définitif est attribué uniquement à l’envoi du devis.
        </p>
      </div>

      {isEdit && loading && (
        <Card className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Chargement du devis…
        </Card>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {locked && (
        <Alert variant="warning" title="Devis non modifiable">
          Ce devis n’est plus un brouillon. Consultez sa fiche pour suivre son statut.
        </Alert>
      )}

      {!loading && !loadError && !locked && (
        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          {globalError && <Alert variant="error">{globalError}</Alert>}

          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-navy">Informations</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Select
                  id="client_id"
                  label="Client *"
                  options={clientOptions}
                  value={form.client_id}
                  onChange={(event) => updateHeader('client_id', event.target.value)}
                  error={errors.header.client_id}
                  disabled={references.loading}
                />
              </div>

              <Input
                id="client_reference"
                label="Référence client"
                placeholder="PO-2026-001"
                value={form.client_reference}
                onChange={(event) => updateHeader('client_reference', event.target.value)}
                error={errors.header.client_reference}
                autoComplete="off"
              />

              <Input
                id="valid_until"
                label="Valable jusqu’au"
                type="date"
                value={form.valid_until}
                onChange={(event) => updateHeader('valid_until', event.target.value)}
                error={errors.header.valid_until}
                hint="Par défaut : 30 jours après l’envoi."
              />

              <Textarea
                id="notes"
                label="Notes"
                value={form.notes}
                onChange={(event) => updateHeader('notes', event.target.value)}
                error={errors.header.notes}
                rows={3}
              />

              <Textarea
                id="terms"
                label="Conditions"
                value={form.terms}
                onChange={(event) => updateHeader('terms', event.target.value)}
                error={errors.header.terms}
                rows={3}
              />
            </div>

            {!references.loading && references.clients.length === 0 && (
              <Alert variant="info">
                Aucun client actif. <Link to="/app/clients/nouveau">Créez un client</Link> avant
                d’enregistrer un devis.
              </Alert>
            )}
          </Card>

          <Card className="space-y-4">
            <QuoteLineItemsEditor
              items={form.items}
              products={references.products}
              errors={errors.items}
              onChange={(items) => setForm((current) => ({ ...current, items }))}
            />
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-navy">Récapitulatif</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Sous-total</dt>
                <dd className="tabular-nums text-navy">{formatAmount(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Remises</dt>
                <dd className="tabular-nums text-navy">− {formatAmount(totals.discountTotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">TVA</dt>
                <dd className="tabular-nums text-navy">{formatAmount(totals.taxTotal)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold">
                <dt className="text-navy">Total</dt>
                <dd className="tabular-nums text-navy">{formatAmount(totals.total)}</dd>
              </div>
            </dl>
          </Card>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Link
              to={backTo}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              Annuler
            </Link>
            <Button type="submit" isLoading={submitting}>
              {isEdit ? 'Enregistrer les modifications' : 'Créer le devis'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
