import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-navy text-white shadow-sm hover:bg-navy-light focus-visible:ring-navy disabled:hover:bg-navy',
  secondary:
    'border border-line bg-white text-navy hover:border-slate-300 hover:bg-app focus-visible:ring-brand-blue',
  ghost: 'text-navy hover:bg-brand-soft focus-visible:ring-brand-blue',
  danger:
    'bg-danger text-white shadow-sm hover:bg-red-700 focus-visible:ring-danger disabled:hover:bg-danger',
};

export default function Button({
  variant = 'primary',
  className,
  isLoading = false,
  type = 'button',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
