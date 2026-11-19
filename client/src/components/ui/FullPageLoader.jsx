import { Loader2 } from 'lucide-react';
import Logo from './Logo.jsx';

export default function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-6">
        <Logo />
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Chargement de votre espace…
        </div>
      </div>
    </div>
  );
}
