import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  FileDown,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { apiErrorMessage } from '../../lib/errors.js';
import { formatAmount, formatDate, formatDateTime, formatTaxRate } from '../../lib/format.js';
import { changeQuoteStatus, deleteQuote, getQuote, markQuoteSent } from './api.js';
import { EXEMPTION_CODE_LABELS, QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANTS } from './schemas.js';

function DetailRow({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-navy">{children || '—'}</dd>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <Badge variant={QUOTE_STATUS_VARIANTS[status] ?? 'neutral'}>
      {QUOTE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function TaxCell({ item }) {
  if (Number(item.taxRate) === 0) {
    const label = EXEMPTION_CODE_LABELS[item.taxExemptionCode] ?? 'Exonéré';

    return (
      <span className="text-xs text-muted">
        {label}
        {item.taxExemptionCode === 'other' && item.taxExemptionReason
          ? ` — ${item.taxExemptionReason}`
          : ''}
      </span>
    );
  }

  return <span className="tabular-nums text-muted">{formatTaxRate(item.taxRate)}</span>;
}

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [request, setRequest] = useState({
    key: null,
    status: 'loading',
    error: '',
    quote: null,
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [flash, setFlash] = useState(location.state?.flash ?? '');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingSend, setPendingSend] = useState(false);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const requestKey = `${id}:${reloadKey}`;
  const loading = request.key !== requestKey;
  const error = request.key === requestKey ? request.error : '';
  const quote = request.key === requestKey ? request.quote : null;

  useEffect(() => {
    if (!flash) return undefined;

    const timer = setTimeout(() => setFlash(''), 4500);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    let active = true;

    getQuote(id)
      .then((data) => {
        if (!active) return;

        setRequest({ key: requestKey, status: 'success', error: '', quote: data });
      })
      .catch((requestError) => {
        if (!active) return;

        setRequest({
          key: requestKey,
          status: 'error',
          error: apiErrorMessage(requestError, 'Impossible de charger ce devis.'),
          quote: null,
        });
      });

    return () => {
      active = false;
    };
  }, [id, requestKey]);

  function replaceQuote(data) {
    setRequest({ key: requestKey, status: 'success', error: '', quote: data });
  }

  async function sendQuote() {
    setBusy('send');
    setActionError('');

    try {
      const data = await markQuoteSent(id);
      replaceQuote(data);
      setPendingSend(false);
      setFlash(`Devis envoyé sous le numéro ${data.number}.`);
    } catch (requestError) {
      setActionError(apiErrorMessage(requestError, 'Impossible d’envoyer ce devis.'));
    } finally {
      setBusy('');
    }
  }

  async function changeStatus(status) {
    setBusy(status);
    setActionError('');

    try {
      const data = await changeQuoteStatus(id, status);
      replaceQuote(data);
      setFlash(status === 'accepted' ? 'Devis accepté.' : 'Devis refusé.');
    } catch (requestError) {
      setActionError(apiErrorMessage(requestError, 'Impossible de changer le statut.'));
    } finally {
      setBusy('');
    }
  }

  async function confirmDelete() {
    setBusy('delete');
    setActionError('');

    try {
      await deleteQuote(id);
      navigate('/app/quotes', { replace: true, state: { flash: 'Devis supprimé.' } });
    } catch (requestError) {
      setActionError(apiErrorMessage(requestError, 'Impossible de supprimer ce devis.'));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/app/quotes"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-navy"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour aux devis
      </Link>

      {loading && (
        <Card className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Chargement du devis…
        </Card>
      )}

      {error && (
        <Alert variant="error" title="Chargement impossible">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Réessayer
            </Button>
          </div>
        </Alert>
      )}

      {quote && !loading && !error && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
                {quote.number ?? 'Devis brouillon'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                  {quote.clientName}
                </h1>
                <StatusBadge status={quote.status} />
              </div>
              <p className="mt-2 text-sm text-muted">
                {quote.number
                  ? 'Document numéroté et figé. Les modifications passent par une nouvelle version.'
                  : 'Brouillon modifiable. Le numéro sera attribué à l’envoi.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/v1/quotes/${quote.id}/pdf`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
              >
                <FileDown className="size-4" aria-hidden="true" />
                PDF
              </a>

              {quote.status === 'draft' && (
                <>
                  <Link
                    to={`/app/quotes/${quote.id}/modifier`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Modifier
                  </Link>
                  <Button onClick={() => setPendingSend(true)}>
                    <Send className="size-4" aria-hidden="true" />
                    Envoyer
                  </Button>
                  <Button variant="danger" onClick={() => setPendingDelete(true)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Supprimer
                  </Button>
                </>
              )}

              {quote.status === 'sent' && (
                <>
                  <Button isLoading={busy === 'accepted'} onClick={() => changeStatus('accepted')}>
                    <Check className="size-4" aria-hidden="true" />
                    Accepter
                  </Button>
                  <Button
                    variant="secondary"
                    isLoading={busy === 'refused'}
                    onClick={() => changeStatus('refused')}
                  >
                    <X className="size-4" aria-hidden="true" />
                    Refuser
                  </Button>
                </>
              )}
            </div>
          </div>

          {flash && <Alert variant="success">{flash}</Alert>}
          {actionError && <Alert variant="error">{actionError}</Alert>}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <h2 className="text-lg font-bold text-navy">Détails</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailRow label="Client">{quote.clientName}</DetailRow>
                <DetailRow label="Référence client">{quote.clientReference}</DetailRow>
                <DetailRow label="Date d’envoi">{formatDate(quote.issueDate)}</DetailRow>
                <DetailRow label="Valable jusqu’au">{formatDate(quote.validUntil)}</DetailRow>
                <DetailRow label="Envoyé le">{formatDateTime(quote.sentAt)}</DetailRow>
                <DetailRow label="Accepté le">{formatDateTime(quote.acceptedAt)}</DetailRow>
              </dl>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-navy">Totaux</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Sous-total</dt>
                  <dd className="tabular-nums text-navy">{formatAmount(quote.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Remises</dt>
                  <dd className="tabular-nums text-navy">− {formatAmount(quote.discountTotal)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">TVA</dt>
                  <dd className="tabular-nums text-navy">{formatAmount(quote.taxTotal)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold">
                  <dt className="text-navy">Total</dt>
                  <dd className="tabular-nums text-navy">{formatAmount(quote.total)}</dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-lg font-bold text-navy">Lignes</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">Lignes du devis</caption>
                <thead className="bg-app text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Description
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Qté
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Prix unitaire
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Remise
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      TVA
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {quote.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy">{item.description}</p>
                        {item.unit && <p className="text-xs text-muted">{item.unit}</p>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy">
                        {Number(item.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy">
                        {formatAmount(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {formatTaxRate(item.discountRate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TaxCell item={item} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-navy">
                        {formatAmount(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {(quote.notes || quote.terms) && (
            <div className="grid gap-6 md:grid-cols-2">
              {quote.notes && (
                <Card>
                  <h2 className="text-lg font-bold text-navy">Notes</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                    {quote.notes}
                  </p>
                </Card>
              )}
              {quote.terms && (
                <Card>
                  <h2 className="text-lg font-bold text-navy">Conditions</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                    {quote.terms}
                  </p>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingSend}
        title="Envoyer ce devis ?"
        description="Un numéro définitif sera attribué et le devis ne sera plus modifiable."
        confirmLabel="Envoyer"
        isLoading={busy === 'send'}
        error={actionError}
        onConfirm={sendQuote}
        onCancel={() => {
          setPendingSend(false);
          setActionError('');
        }}
      />

      <ConfirmDialog
        open={pendingDelete}
        title="Supprimer ce devis ?"
        description="Ce brouillon sera supprimé définitivement."
        confirmLabel="Supprimer"
        isLoading={busy === 'delete'}
        error={actionError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(false);
          setActionError('');
        }}
      />
    </div>
  );
}
