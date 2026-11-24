import clsx from 'clsx';

const VARIANTS = {
  success: 'border-green-200 bg-green-50 text-success',
  neutral: 'border-line bg-app text-muted',
  danger: 'border-red-200 bg-red-50 text-danger',
  info: 'border-blue-200 bg-brand-soft text-navy',
};

export default function Badge({ variant = 'neutral', className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
