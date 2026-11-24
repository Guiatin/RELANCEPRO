import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Alert from './Alert.jsx';
import Button from './Button.jsx';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  isLoading = false,
  error,
  onConfirm,
  onCancel,
}) {
  const headingRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    headingRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isLoading) onCancel();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy/75 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fermer la confirmation"
        onClick={() => !isLoading && onCancel()}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-danger">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="confirm-dialog-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-bold tracking-tight text-navy outline-none"
            >
              {title}
            </h2>
            {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
          </div>
        </div>

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
