import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BellRing,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/auth-context.js';
import Logo from '../ui/Logo.jsx';

const NAV_GROUPS = [
  {
    label: 'Pilotage',
    items: [{ label: 'Tableau de bord', to: '/app', icon: LayoutDashboard }],
  },
  {
    label: 'Commercial',
    items: [
      { label: 'Clients', to: '/app/clients', icon: Users },
      { label: 'Produits & services', icon: Package, soon: true },
      { label: 'Devis', icon: FileText, soon: true },
      { label: 'Factures', icon: ReceiptText, soon: true },
      { label: 'Paiements', icon: CreditCard, soon: true },
      { label: 'Relances', icon: BellRing, soon: true },
    ],
  },
  {
    label: 'Compte',
    items: [
      { label: 'Paramètres', icon: Settings, soon: true },
      { label: 'Sécurité', to: '/app/parametres/securite', icon: ShieldCheck },
    ],
  },
];

const PAGE_TITLES = {
  '/app': 'Tableau de bord',
  '/app/clients': 'Clients',
  '/app/clients/nouveau': 'Nouveau client',
  '/app/parametres/securite': 'Sécurité du compte',
};

function pageTitle(pathname) {
  if (/^\/app\/clients\/[^/]+\/modifier$/.test(pathname)) return 'Modifier le client';
  if (/^\/app\/clients\/[^/]+$/.test(pathname)) return 'Fiche client';

  return PAGE_TITLES[pathname] ?? 'Espace entreprise';
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function SidebarContent({ onNavigate }) {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logout();
      navigate('/connexion', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo inverse compact />
      </div>

      <nav
        className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
        aria-label="Navigation principale"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              {group.label}
            </p>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;

                if (item.soon) {
                  return (
                    <li key={item.label}>
                      <span
                        aria-disabled="true"
                        className="flex min-h-10 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-sm text-white/35"
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                          Bientôt
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.label}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/app'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        clsx(
                          'flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/65 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-navy">
            {initials(user?.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
            <p className="truncate text-xs text-white/50">{company?.name}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="grid size-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
            aria-label="Se déconnecter"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, company, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const title = pageTitle(location.pathname);

  useEffect(() => {
    if (!drawerOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logout();
      navigate('/connexion', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-app">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy"
      >
        Aller au contenu
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] bg-navy lg:block">
        <SidebarContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-navy/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-navy shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Fermer le menu"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-line text-navy hover:bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy">{title}</p>
            <p className="truncate text-xs text-muted">{company?.name}</p>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-semibold text-navy">{user?.full_name}</p>
              <p className="text-xs capitalize text-muted">{user?.role}</p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-xs font-bold text-navy">
              {initials(user?.full_name)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="grid size-10 place-items-center rounded-xl border border-line text-muted transition hover:bg-app hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-50"
            aria-label="Se déconnecter"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </header>

        <main id="contenu" className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
