import clsx from 'clsx';

export default function Card({ className, children }) {
  return (
    <section
      className={clsx(
        'rounded-2xl border border-line bg-white p-5 shadow-[0_16px_40px_-32px_rgba(11,31,58,0.4)] sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  );
}
