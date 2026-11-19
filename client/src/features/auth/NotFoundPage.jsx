import { Link } from 'react-router-dom';
import Logo from '../../components/ui/Logo.jsx';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.2em] text-brand-blue">
          Erreur 404
        </p>
        <h1 className="mt-3 text-2xl font-bold text-navy">Cette page n’existe pas.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Le lien est peut-être incomplet ou la page a été déplacée.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-navy px-5 text-sm font-semibold text-white transition hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
        >
          Revenir à mon espace
        </Link>
      </div>
    </div>
  );
}
