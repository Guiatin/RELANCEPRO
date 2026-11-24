import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Select from '../../components/ui/Select.jsx';
import { apiErrorMessage } from '../../lib/errors.js';
import { deleteClient, listClients } from './api.js';

const PAGE_SIZE = 20;
const INITIAL_FILTERS = { search: '', active: '', page: 1 };
const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'true', label: 'Actifs' },
  { value: 'false', label: 'Inactifs' },
];

function StatusBadge({ client }) {
  return (
    <Badge variant={client.isActive ? 'success' : 'neutral'}>
      {client.isActive ? 'Actif' : 'Inactif'}
    </Badge>
  );
}

function ClientActions({ client, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      <Link
        to={`/app/clients/${client.id}`}
        aria-label={`Consulter ${client.name}`}
        title="Consulter"
        className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-app hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        <Eye className="size-4" aria-hidden="true" />
      </Link>
      <Link
        to={`/app/clients/${client.id}/modifier`}
        aria-label={`Modifier ${client.name}`}
        title="Modifier"
        className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-app hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        <Pencil className="size-4" aria-hidden="true" />
      </Link>
      <button
        type="button"
        onClick={() => onDelete(client)}
        aria-label={`Supprimer ${client.name}`}
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

export default function ClientsPage() {
  const location = useLocation();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [clients, setClients] = useState([]);
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
    if (filters.active) params.active = filters.active;

    listClients(params)
      .then((payload) => {
        if (!active) return;

        setClients(payload.data);
        setMeta(payload.meta);
      })
      .catch((requestError) => {
        if (!active) return;

        setError(apiErrorMessage(requestError, 'Impossible de charger les clients.'));
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
  const hasFilters = Boolean(filters.search || filters.active);

  function changeStatus(active) {
    setLoading(true);
    setError('');
    setFilters((current) => ({ ...current, active, page: 1 }));
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
      await deleteClient(pendingDelete.id);
      setPendingDelete(null);
      setFlash('Client supprimé.');
      setLoading(true);
      setError('');

      if (clients.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      } else {
        setReloadKey((key) => key + 1);
      }
    } catch (requestError) {
      setDeleteError(apiErrorMessage(requestError, 'Impossible de supprimer ce client.'));
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
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Clients</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Gérez vos fiches clients, leurs coordonnées et leur statut commercial.
          </p>
        </div>

        <Link
          to="/app/clients/nouveau"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nouveau client
        </Link>
      </div>

      {flash && <Alert variant="success">{flash}</Alert>}

      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-1.5">
            <label htmlFor="client-search" className="block text-sm font-medium text-navy">
              Rechercher
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                id="client-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nom, contact, email ou téléphone…"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3.5 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          </div>

          <Select
            id="client-status"
            label="Statut"
            options={STATUS_OPTIONS}
            value={filters.active}
            onChange={(event) => changeStatus(event.target.value)}
          />
        </div>

        <p className="text-sm text-muted" role="status">
          {loading
            ? 'Chargement des clients…'
            : `${total} client${total > 1 ? 's' : ''}${hasFilters ? ' correspondant aux filtres' : ''}`}
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

      {!error && loading && clients.length === 0 && (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="min-w-full text-left text-sm" aria-busy="true">
              <caption className="sr-only">Chargement de la liste des clients</caption>
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

      {!error && !loading && clients.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-blue">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-navy">
            {hasFilters ? 'Aucun client ne correspond' : 'Aucun client pour le moment'}
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted">
            {hasFilters
              ? 'Modifiez votre recherche ou réinitialisez les filtres pour retrouver vos clients.'
              : 'Ajoutez votre premier client pour préparer vos devis et factures.'}
          </p>
          {hasFilters ? (
            <Button variant="secondary" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          ) : (
            <Link
              to="/app/clients/nouveau"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nouveau client
            </Link>
          )}
        </Card>
      )}

      {!error && clients.length > 0 && (
        <div className="space-y-4">
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Liste des clients</caption>
              <thead className="bg-app text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Nom
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Contact
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Téléphone
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Ville
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
                {clients.map((client) => (
                  <tr key={client.id} className="transition hover:bg-app/60">
                    <td className="px-4 py-3">
                      <Link
                        to={`/app/clients/${client.id}`}
                        className="font-semibold text-navy hover:text-brand-blue"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{client.contactName || '—'}</td>
                    <td className="px-4 py-3 text-muted">{client.email || '—'}</td>
                    <td className="px-4 py-3 text-muted">
                      {client.phone || client.whatsapp || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">{client.city || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge client={client} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <ClientActions client={client} onDelete={setPendingDelete} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {clients.map((client) => (
              <li key={client.id}>
                <Card className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/app/clients/${client.id}`}
                        className="block truncate text-base font-bold text-navy hover:text-brand-blue"
                      >
                        {client.name}
                      </Link>
                      {client.contactName && (
                        <p className="mt-0.5 truncate text-sm text-muted">{client.contactName}</p>
                      )}
                    </div>
                    <StatusBadge client={client} />
                  </div>

                  <dl className="space-y-1 text-sm text-muted">
                    <div className="truncate">
                      <dt className="sr-only">Email</dt>
                      <dd>{client.email || '—'}</dd>
                    </div>
                    <div className="truncate">
                      <dt className="sr-only">Téléphone</dt>
                      <dd>{client.phone || client.whatsapp || '—'}</dd>
                    </div>
                    <div className="truncate">
                      <dt className="sr-only">Ville</dt>
                      <dd>{client.city || '—'}</dd>
                    </div>
                  </dl>

                  <div className="flex justify-end border-t border-line pt-1">
                    <ClientActions client={client} onDelete={setPendingDelete} />
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
        title="Supprimer ce client ?"
        description={
          pendingDelete
            ? `La fiche de « ${pendingDelete.name} » sera retirée de la liste. Cette action est définitive depuis l’interface.`
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
