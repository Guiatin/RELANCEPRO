import { useId } from 'react';
import clsx from 'clsx';

export default function Input({ label, error, hint, endAdornment, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-navy">
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(
            'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-brand-blue/30',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/20'
              : 'border-line focus:border-brand-blue',
            endAdornment && 'pr-12',
            className,
          )}
          {...props}
        />

        {endAdornment && (
          <div className="absolute inset-y-0 right-2 flex items-center">{endAdornment}</div>
        )}
      </div>

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
