import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import Alert from '../../components/ui/Alert.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { apiErrorMessage } from '../../lib/errors.js';
import { formatAmount, formatDateTime, formatTaxRate } from '../../lib/format.js';
import { deleteProduct, getProduct } from './api.js';

const TYPE_LABELS = { product: 'Produit', service: 'Service' };

function DetailRow({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-navy">{children || '—'}</dd>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [request, setRequest] = useState({
    key: null,
    status: 'loading',
    error: '',
    product: null,
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [flash, setFlash] = useState(location.state?.flash ?? '');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const requestKey = `${id}:${reloadKey}`;
  const loading = request.key !== requestKey;
  const error = request.key === requestKey ? request.error : '';
  const product = request.key === requestKey ? request.product : null;

  useEffect(() => {
    if (!flash) return undefined;

    const timer = setTimeout(() => setFlash(''), 4500);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    let active = true;

    getProduct(id)
      .then((data) => {
        if (!active) return;

        setRequest({ key: requestKey, status: 'success', error: '', product: data });
      })
      .catch((requestError) => {
        if (!active) return;

        setRequest({
          key: requestKey,
          status: 'error',
          error: apiErrorMessage(requestError, 'Impossible de charger ce produit.'),
          product: null,
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
      await deleteProduct(pendingDelete.id);
      navigate('/app/products', { replace: true, state: { flash: 'Produit supprimé.' } });
    } catch (requestError) {
      setDeleteError(apiErrorMessage(requestError, 'Impossible de supprimer ce produit.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/app/products"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-navy"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour aux produits
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

      {product && !loading && !error && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
                Fiche produit
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                  {product.name}
                </h1>
                <Badge variant="info">{TYPE_LABELS[product.type] ?? product.type}</Badge>
                <Badge variant={product.isActive ? 'success' : 'neutral'}>
                  {product.isActive ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted">
                Prix, unité et fiscalité du produit ou service.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to={`/app/products/${product.id}/modifier`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Modifier
              </Link>
              <Button variant="danger" onClick={() => setPendingDelete(product)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Supprimer
              </Button>
            </div>
          </div>

          {flash && <Alert variant="success">{flash}</Alert>}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <h2 className="text-lg font-bold text-navy">Tarification</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailRow label="Prix unitaire">
                  <span className="font-semibold tabular-nums">
                    {formatAmount(product.unitPrice)}
                  </span>
                </DetailRow>
                <DetailRow label="Taux de TVA">{formatTaxRate(product.taxRate)}</DetailRow>
                <DetailRow label="Unité">{product.unit}</DetailRow>
              </dl>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-navy">Suivi</h2>
              <dl className="mt-4 space-y-4">
                <DetailRow label="Type">{TYPE_LABELS[product.type] ?? product.type}</DetailRow>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Statut
                  </dt>
                  <dd className="mt-1">
                    <Badge variant={product.isActive ? 'success' : 'neutral'}>
                      {product.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </dd>
                </div>
                <DetailRow label="Créé le">{formatDateTime(product.createdAt)}</DetailRow>
                <DetailRow label="Modifié le">{formatDateTime(product.updatedAt)}</DetailRow>
              </dl>
            </Card>
          </div>

          {product.description && (
            <Card>
              <h2 className="text-lg font-bold text-navy">Description</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                {product.description}
              </p>
            </Card>
          )}
        </>
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
