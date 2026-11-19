import { CheckCircle2, ShieldCheck } from 'lucide-react';
import Logo from '../ui/Logo.jsx';

const ARGUMENTS = [
  'Devis et factures numérotés, prêts à envoyer.',
  'Relances suivies, sans oublier un impayé.',
  'Un code de récupération pour garder la main.',
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-navy px-6 py-8 text-white sm:px-10 lg:px-14 lg:py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(circle at 18% 12%, rgba(47,111,237,0.35), transparent 26rem), radial-gradient(circle at 92% 88%, rgba(255,255,255,0.08), transparent 22rem)',
          }}
        />

        <div className="relative">
          <Logo inverse />
          <h1 className="mt-10 max-w-lg text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Reprenez le contrôle de vos encaissements.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/70">
            RelancePro rassemble vos clients, devis, factures, paiements et relances dans un espace
            simple, conçu pour les petites entreprises du Burkina Faso.
          </p>

          <ul className="mt-8 hidden space-y-3 sm:block">
            {ARGUMENTS.map((argument) => (
              <li key={argument} className="flex items-start gap-3 text-sm text-white/80">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-white" aria-hidden="true" />
                {argument}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/65">
          <span className="rounded-full border border-white/15 px-3 py-1">Burkina Faso</span>
          <span className="rounded-full border border-white/15 px-3 py-1">FCFA</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Données isolées par entreprise
          </span>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              Espace entreprise
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
              {title}
            </h2>
            {subtitle && <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>}
          </div>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
