import clsx from 'clsx';

export default function Logo({ inverse = false, compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={clsx(
          'grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black tracking-tight',
          inverse ? 'bg-white text-navy' : 'bg-navy text-white',
        )}
      >
        RP
      </span>
      <div>
        <p
          className={clsx('text-base font-bold leading-none', inverse ? 'text-white' : 'text-navy')}
        >
          RelancePro
        </p>
        {!compact && (
          <p
            className={clsx(
              'mt-1 text-[11px] font-medium',
              inverse ? 'text-white/60' : 'text-muted',
            )}
          >
            Gestion commerciale
          </p>
        )}
      </div>
    </div>
  );
}
