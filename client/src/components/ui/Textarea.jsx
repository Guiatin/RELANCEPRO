import { useId } from 'react';
import clsx from 'clsx';

export default function Textarea({ label, error, hint, className, id, rows = 4, ...props }) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={textareaId} className="block text-sm font-medium text-navy">
        {label}
      </label>

      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          'w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-sm leading-6 text-navy outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-brand-blue/30',
          error
            ? 'border-danger focus:border-danger focus:ring-danger/20'
            : 'border-line focus:border-brand-blue',
          className,
        )}
        {...props}
      />

      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
