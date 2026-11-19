import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  FileText,
  ReceiptText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import { useAuth } from '../../context/auth-context.js';

const MODULES = [
  {
    title: 'Clients',
    description: 'Fiches, coordonnées et historique commercial.',
    icon: Users,
  },
  {
    title: 'Devis',
    description: 'Brouillons, envoi numéroté et conversion en facture.',
    icon: FileText,
  },
  {
    title: 'Factures',
    description: 'Émission, échéances et suivi des soldes.',
    icon: ReceiptText,
  },
  {
    title: 'Relances',
    description: 'Planification et journal des relances manuelles.',
    icon: BellRing,
  },
];

export default function DashboardPage() {
  const { user, company } = useAuth();
  const firstName = user?.full_name?.split(' ')[0] ?? '';

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
            {company?.name}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            Bonjour {firstName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Votre espace entreprise est actif. Les modules commerciaux seront ajoutés un par un,
            avec validation et tests à chaque étape.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>
          Inscription et session sécurisées. Votre mot de passe est chiffré et votre code de
          récupération n’est stocké que sous forme d’empreinte.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((module) => {
          const Icon = module.icon;

          return (
            <Card key={module.title} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-blue">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="rounded-full bg-app px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Bientôt
                </span>
              </div>
              <h2 className="mt-4 text-base font-bold text-navy">{module.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{module.description}</p>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col justify-between gap-5 bg-navy text-white sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Protégez votre accès</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70">
              Changez votre mot de passe ou régénérez votre code de récupération. L’ancien code est
              immédiatement révoqué.
            </p>
          </div>
        </div>
        <Link
          to="/app/parametres/securite"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-navy transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
        >
          Gérer la sécurité
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Card>
    </div>
  );
}
