import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, FileText, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Select from '../../components/ui/Select.jsx';
import { apiErrorMessage } from '../../lib/errors.js';
import { formatAmount, formatDate } from '../../lib/format.js';
import { deleteQuote, listQuotes } from './api.js';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_OPTIONS, QUOTE_STATUS_VARIANTS } from './schemas.js';

const PAGE_SIZE = 20;
const INITIAL_FILTERS = { reference: '', status: '', page: 1 };

function QuoteStatusBadge({ status }) {
  return (
    <Badge variant={QUOTE_STATUS_VARIANTS[status] ?? 'neutral'}>
      {QUOTE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function QuoteActions({ quote, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      <Link
        to={`/app/quotes/${quote.id}`}
        aria-label={`Consulter le devis ${quote.number ?? quote.id}`}
        title="Consulter"
        className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-app hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        <Eye className="size-4" aria-hidden="true" />
      </Link>

      {quote.status === 'draft' && (
        <>
          <Link
            to={`/app/quotes/${quote.id}/modifier`}
            aria-label={`Modifier le devis ${quote.number ?? quote.id}`}
            title="Modifier"
            className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-app hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => onDelete(quote)}
            aria-label={`Supprimer le devis ${quote.number ?? quote.id}`}
            title="Supprimer"
            className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

function TableSkeleton() {
  return Array.from({ length: 5 }, (_, row) => (
    <tr key={row}>
      {Array.from({ length: 6 }, (_, cell) => (
        <td key={cell} className="px-4 py-4">
          <span className="block h-3 w-24 animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  ));
}

export default function QuotesPage() {
  const location = useLocation();
  const [referenceInput, setReferenceInput] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [quotes, setQuotes] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [flash, setFlash] = useState(location.state?.flash ?? '');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!flash) return undefined;

    const timer = setTimeout(() => setFlash(''), 4500);
    return () => clearTimeout(timer);
  }, [flash]);

  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const reference = referenceInput.trim();

      if (filtersRef.current.reference === reference) return;

      setLoading(true);
      setError('');
      setFilters((current) => ({ ...current, reference, page: 1 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [referenceInput]);

  useEffect(() => {
    let active = true;

    const params = { page: filters.page, limit: PAGE_SIZE };
    if (filters.reference) params.reference = filters.reference;
    if (filters.status) params.status = filters.status;

    listQuotes(params)
      .then((payload) => {
        if (!active) return;

        setQuotes(payload.data);
        setMeta(payload.meta);
      })
      .catch((requestError) => {
        if (!active) return;

        setError(apiErrorMessage(requestError, 'Impossible de charger les devis.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  const total = meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(filters.reference || filters.status);

  function applyFilter(field, value) {
    setLoading(true);
    setError('');
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  }

  function resetFilters() {
    setLoading(true);
    setError('');
    setReferenceInput('');
    setFilters(INITIAL_FILTERS);
  }

  function retry() {
    setLoading(true);
    setError('');
    setReloadKey((key) => key + 1);
  }

  function changePage(page) {
    setLoading(true);
    setFilters((current) => ({ ...current, page }));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError('');

    try {
      await deleteQuote(pendingDelete.id);
      setPendingDelete(null);
      setFlash('Devis supprimé.');
      setLoading(true);
      setError('');

      if (quotes.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      } else {
        setReloadKey((key) => key + 1);
      }
    } catch (requestError) {
      setDeleteError(apiErrorMessage(requestError, 'Impossible de supprimer ce devis.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
            Commercial
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Devis</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Préparez vos devis, envoyez-les pour leur attribuer un numéro, puis suivez leur statut.
          </p>
        </div>

        <Link
          to="/app/quotes/nouveau"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nouveau devis
        </Link>
      </div>

      {flash && <Alert variant="success">{flash}</Alert>}

      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-1.5">
            <label htmlFor="quote-reference" className="block text-sm font-medium text-navy">
              Référence client
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                id="quote-reference"
                type="search"
                value={referenceInput}
                onChange={(event) => setReferenceInput(event.target.value)}
                placeholder="PO-2026-001…"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3.5 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          </div>

          <Select
            id="quote-status-filter"
            label="Statut"
            options={QUOTE_STATUS_OPTIONS}
            value={filters.status}
            onChange={(event) => applyFilter('status', event.target.value)}
          />
        </div>

        <p className="text-sm text-muted" role="status">
          {loading
            ? 'Chargement des devis…'
            : `${total} devis${hasFilters ? ' correspondant aux filtres' : ''}`}
        </p>
      </Card>

      {error && (
        <Alert variant="error" title="Chargement impossible">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button variant="secondary" onClick={retry}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Réessayer
            </Button>
          </div>
        </Alert>
      )}

      {!error && loading && quotes.length === 0 && (
        <Card className="overflow-hidden p-0">
          <table className="min-w-full text-left text-sm" aria-busy="true">
            <caption className="sr-only">Chargement de la liste des devis</caption>
            <tbody>
              <TableSkeleton />
            </tbody>
          </table>
        </Card>
      )}

      {!error && !loading && quotes.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-blue">
            <FileText className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-navy">
            {hasFilters ? 'Aucun devis ne correspond' : 'Aucun devis pour le moment'}
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted">
            {hasFilters
              ? 'Modifiez votre recherche ou réinitialisez les filtres.'
              : 'Créez votre premier devis à partir de vos clients et produits.'}
          </p>
          {hasFilters ? (
            <Button variant="secondary" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          ) : (
            <Link
              to="/app/quotes/nouveau"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nouveau devis
            </Link>
          )}
        </Card>
      )}

      {!error && quotes.length > 0 && (
        <div className="space-y-4">
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Liste des devis</caption>
              <thead className="bg-app text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Numéro
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Client
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Statut
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Total
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="transition hover:bg-app/60">
                    <td className="px-4 py-3">
                      <Link
                        to={`/app/quotes/${quote.id}`}
                        className="font-semibold text-navy hover:text-brand-blue"
                      >
                        {quote.number ?? 'Brouillon'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-navy">{quote.clientName}</td>
                    <td className="px-4 py-3">
                      <QuoteStatusBadge status={quote.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(quote.issueDate ?? quote.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-navy">
                      {formatAmount(quote.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <QuoteActions quote={quote} onDelete={setPendingDelete} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {quotes.map((quote) => (
              <li key={quote.id}>
                <Card className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/app/quotes/${quote.id}`}
                        className="block truncate text-base font-bold text-navy hover:text-brand-blue"
                      >
                        {quote.number ?? 'Brouillon'}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted">{quote.clientName}</p>
                    </div>
                    <QuoteStatusBadge status={quote.status} />
                  </div>

                  <dl className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <dt className="sr-only">Date</dt>
                      <dd className="text-muted">
                        {formatDate(quote.issueDate ?? quote.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Total</dt>
                      <dd className="font-semibold tabular-nums text-navy">
                        {formatAmount(quote.total)}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex justify-end border-t border-line pt-1">
                    <QuoteActions quote={quote} onDelete={setPendingDelete} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Page {filters.page} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => changePage(filters.page - 1)}
                disabled={filters.page <= 1 || loading}
              >
                Précédent
              </Button>
              <Button
                variant="secondary"
                onClick={() => changePage(filters.page + 1)}
                disabled={filters.page >= totalPages || loading}
              >
                Suivant
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Supprimer ce devis ?"
        description={
          pendingDelete
            ? `Le devis ${pendingDelete.number ?? 'brouillon'} de ${pendingDelete.clientName} sera supprimé.`
            : ''
        }
        confirmLabel="Supprimer"
        isLoading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError('');
        }}
      />
    </div>
  );
}
