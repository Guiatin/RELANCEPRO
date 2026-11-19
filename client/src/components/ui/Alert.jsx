import clsx from 'clsx';

const VARIANTS = {
  error: 'border-red-200 bg-red-50 text-danger',
  success: 'border-green-200 bg-green-50 text-success',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-brand-soft text-navy',
};

export default function Alert({ variant = 'info', title, children, className }) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={clsx('rounded-xl border px-4 py-3 text-sm', VARIANTS[variant], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-1' : undefined}>{children}</div>
    </div>
  );
}
