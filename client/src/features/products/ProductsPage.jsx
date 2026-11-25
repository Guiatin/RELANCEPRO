import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, Package, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Select from '../../components/ui/Select.jsx';
import { apiErrorMessage } from '../../lib/errors.js';
import { formatAmount, formatTaxRate } from '../../lib/format.js';
import { deleteProduct, listProducts } from './api.js';
import { PRODUCT_TYPE_OPTIONS } from './schemas.js';

const PAGE_SIZE = 20;
const INITIAL_FILTERS = { search: '', type: '', active: '', page: 1 };
const TYPE_OPTIONS = [{ value: '', label: 'Tous les types' }, ...PRODUCT_TYPE_OPTIONS];
const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'true', label: 'Actifs' },
  { value: 'false', label: 'Inactifs' },
];
const TYPE_LABELS = { product: 'Produit', service: 'Service' };

function TypeBadge({ type }) {
  return <Badge variant="info">{TYPE_LABELS[type] ?? type}</Badge>;
}

function StatusBadge({ product }) {
  return (
    <Badge variant={product.isActive ? 'success' : 'neutral'}>
      {product.isActive ? 'Actif' : 'Inactif'}
    </Badge>
  );
}

function ProductActions({ product, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      <Link
        to={`/app/products/${product.id}`}
        aria-label={`Consulter ${product.name}`}
        title="Consulter"
        className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-app hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        <Eye className="size-4" aria-hidden="true" />
      </Link>
      <Link
        to={`/app/products/${product.id}/modifier`}
        aria-label={`Modifier ${product.name}`}
        title="Modifier"
        className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-app hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        <Pencil className="size-4" aria-hidden="true" />
      </Link>
      <button
        type="button"
        onClick={() => onDelete(product)}
        aria-label={`Supprimer ${product.name}`}
        title="Supprimer"
        className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function TableSkeleton() {
  return Array.from({ length: 5 }, (_, row) => (
    <tr key={row}>
      {Array.from({ length: 7 }, (_, cell) => (
        <td key={cell} className="px-4 py-4">
          <span className="block h-3 w-24 animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  ));
}

function CardSkeleton() {
  return (
    <li>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="block h-4 w-32 animate-pulse rounded bg-slate-200" />
          <span className="block h-5 w-16 animate-pulse rounded-full bg-slate-200" />
        </div>
        <span className="block h-3 w-48 animate-pulse rounded bg-slate-200" />
        <span className="block h-3 w-40 animate-pulse rounded bg-slate-200" />
      </Card>
    </li>
  );
}

export default function ProductsPage() {
  const location = useLocation();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [products, setProducts] = useState([]);
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
      const search = searchInput.trim();

      if (filtersRef.current.search === search) return;

      setLoading(true);
      setError('');
      setFilters((current) => ({ ...current, search, page: 1 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    const params = { page: filters.page, limit: PAGE_SIZE };
    if (filters.search) params.search = filters.search;
    if (filters.type) params.type = filters.type;
    if (filters.active) params.active = filters.active;

    listProducts(params)
      .then((payload) => {
        if (!active) return;

        setProducts(payload.data);
        setMeta(payload.meta);
      })
      .catch((requestError) => {
        if (!active) return;

        setError(apiErrorMessage(requestError, 'Impossible de charger les produits.'));
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
  const hasFilters = Boolean(filters.search || filters.type || filters.active);

  function applyFilter(field, value) {
    setLoading(true);
    setError('');
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  }

  function resetFilters() {
    setLoading(true);
    setError('');
    setSearchInput('');
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
      await deleteProduct(pendingDelete.id);
      setPendingDelete(null);
      setFlash('Produit supprimé.');
      setLoading(true);
      setError('');

      if (products.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      } else {
        setReloadKey((key) => key + 1);
      }
    } catch (requestError) {
      setDeleteError(apiErrorMessage(requestError, 'Impossible de supprimer ce produit.'));
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
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            Produits & services
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Cataloguez vos produits et services avec leur prix unitaire et leur taux de TVA.
          </p>
        </div>

        <Link
          to="/app/products/nouveau"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nouveau produit
        </Link>
      </div>

      {flash && <Alert variant="success">{flash}</Alert>}

      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_200px]">
          <div className="space-y-1.5">
            <label htmlFor="product-search" className="block text-sm font-medium text-navy">
              Rechercher
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                id="product-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nom ou description…"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3.5 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          </div>

          <Select
            id="product-type-filter"
            label="Type"
            options={TYPE_OPTIONS}
            value={filters.type}
            onChange={(event) => applyFilter('type', event.target.value)}
          />

          <Select
            id="product-status-filter"
            label="Statut"
            options={STATUS_OPTIONS}
            value={filters.active}
            onChange={(event) => applyFilter('active', event.target.value)}
          />
        </div>

        <p className="text-sm text-muted" role="status">
          {loading
            ? 'Chargement des produits…'
            : `${total} produit${total > 1 ? 's' : ''}${hasFilters ? ' correspondant aux filtres' : ''}`}
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

      {!error && loading && products.length === 0 && (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="min-w-full text-left text-sm" aria-busy="true">
              <caption className="sr-only">Chargement de la liste des produits</caption>
              <tbody>
                <TableSkeleton />
              </tbody>
            </table>
          </Card>
          <ul className="space-y-3 md:hidden">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </ul>
        </>
      )}

      {!error && !loading && products.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-blue">
            <Package className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-navy">
            {hasFilters ? 'Aucun produit ne correspond' : 'Aucun produit pour le moment'}
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted">
            {hasFilters
              ? 'Modifiez votre recherche ou réinitialisez les filtres pour retrouver vos produits.'
              : 'Ajoutez votre premier produit ou service pour préparer vos devis et factures.'}
          </p>
          {hasFilters ? (
            <Button variant="secondary" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          ) : (
            <Link
              to="/app/products/nouveau"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nouveau produit
            </Link>
          )}
        </Card>
      )}

      {!error && products.length > 0 && (
        <div className="space-y-4">
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Liste des produits et services</caption>
              <thead className="bg-app text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Nom
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Prix unitaire
                  </th>
                  <th scope="col" className="px-4 py-3">
                    TVA
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Unité
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Statut
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((product) => (
                  <tr key={product.id} className="transition hover:bg-app/60">
                    <td className="px-4 py-3">
                      <Link
                        to={`/app/products/${product.id}`}
                        className="font-semibold text-navy hover:text-brand-blue"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={product.type} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-navy">
                      {formatAmount(product.unitPrice)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {formatTaxRate(product.taxRate)}
                    </td>
                    <td className="px-4 py-3 text-muted">{product.unit || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge product={product} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <ProductActions product={product} onDelete={setPendingDelete} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {products.map((product) => (
              <li key={product.id}>
                <Card className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/app/products/${product.id}`}
                        className="block truncate text-base font-bold text-navy hover:text-brand-blue"
                      >
                        {product.name}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <TypeBadge type={product.type} />
                        {product.unit && (
                          <span className="truncate text-xs text-muted">{product.unit}</span>
                        )}
                      </div>
                    </div>
                    <StatusBadge product={product} />
                  </div>

                  <dl className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <dt className="sr-only">Prix unitaire</dt>
                      <dd className="font-semibold tabular-nums text-navy">
                        {formatAmount(product.unitPrice)}
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">TVA</dt>
                      <dd className="tabular-nums text-muted">{formatTaxRate(product.taxRate)}</dd>
                    </div>
                  </dl>

                  <div className="flex justify-end border-t border-line pt-1">
                    <ProductActions product={product} onDelete={setPendingDelete} />
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
        title="Supprimer ce produit ?"
        description={
          pendingDelete
            ? `« ${pendingDelete.name} » sera retiré du catalogue. Les documents existants ne sont pas modifiés.`
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
