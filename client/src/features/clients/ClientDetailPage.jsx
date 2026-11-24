import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { apiErrorMessage } from '../../lib/errors.js';
import { deleteClient, getClient } from './api.js';

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function DetailRow({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-navy">{children || '—'}</dd>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [request, setRequest] = useState({
    key: null,
    status: 'loading',
    error: '',
    client: null,
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [flash, setFlash] = useState(location.state?.flash ?? '');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const requestKey = `${id}:${reloadKey}`;
  const loading = request.key !== requestKey;
  const error = request.key === requestKey ? request.error : '';
  const client = request.key === requestKey ? request.client : null;

  useEffect(() => {
    if (!flash) return undefined;

    const timer = setTimeout(() => setFlash(''), 4500);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    let active = true;

    getClient(id)
      .then((data) => {
        if (!active) return;

        setRequest({ key: requestKey, status: 'success', error: '', client: data });
      })
      .catch((requestError) => {
        if (!active) return;

        setRequest({
          key: requestKey,
          status: 'error',
          error: apiErrorMessage(requestError, 'Impossible de charger ce client.'),
          client: null,
        });
      });

    return () => {
      active = false;
    };
  }, [id, requestKey]);

  async function confirmDelete() {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError('');

    try {
      await deleteClient(pendingDelete.id);
      navigate('/app/clients', { replace: true, state: { flash: 'Client supprimé.' } });
    } catch (requestError) {
      setDeleteError(apiErrorMessage(requestError, 'Impossible de supprimer ce client.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/app/clients"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-navy"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour aux clients
      </Link>

      {loading && (
        <Card className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Chargement de la fiche…
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

      {client && !loading && !error && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
                Fiche client
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                  {client.name}
                </h1>
                <Badge variant={client.isActive ? 'success' : 'neutral'}>
                  {client.isActive ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted">
                Coordonnées et informations commerciales du client.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to={`/app/clients/${client.id}/modifier`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Modifier
              </Link>
              <Button variant="danger" onClick={() => setPendingDelete(client)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Supprimer
              </Button>
            </div>
          </div>

          {flash && <Alert variant="success">{flash}</Alert>}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <h2 className="text-lg font-bold text-navy">Coordonnées</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailRow label="Contact">{client.contactName}</DetailRow>
                <DetailRow label="Email">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="text-brand-blue hover:underline">
                      {client.email}
                    </a>
                  ) : null}
                </DetailRow>
                <DetailRow label="Téléphone">
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="text-brand-blue hover:underline">
                      {client.phone}
                    </a>
                  ) : null}
                </DetailRow>
                <DetailRow label="WhatsApp">
                  {client.whatsapp ? (
                    <a href={`tel:${client.whatsapp}`} className="text-brand-blue hover:underline">
                      {client.whatsapp}
                    </a>
                  ) : null}
                </DetailRow>
                <div className="sm:col-span-2">
                  <DetailRow label="Adresse">{client.address}</DetailRow>
                </div>
                <DetailRow label="Ville">{client.city}</DetailRow>
              </dl>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-navy">Suivi</h2>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Statut
                  </dt>
                  <dd className="mt-1">
                    <Badge variant={client.isActive ? 'success' : 'neutral'}>
                      {client.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </dd>
                </div>
                <DetailRow label="Créé le">{formatDateTime(client.createdAt)}</DetailRow>
                <DetailRow label="Modifié le">{formatDateTime(client.updatedAt)}</DetailRow>
              </dl>
            </Card>
          </div>

          {client.notes && (
            <Card>
              <h2 className="text-lg font-bold text-navy">Notes</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                {client.notes}
              </p>
            </Card>
          )}
        </>
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
