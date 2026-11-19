import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Printer, ShieldAlert } from 'lucide-react';
import Button from '../ui/Button.jsx';

export default function RecoveryCodeModal({ code, email, onConfirm }) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (!code) return null;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const area = document.createElement('textarea');
      area.value = code;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  function downloadCode() {
    const content = [
      'RelancePro — Code de récupération',
      '',
      `Compte : ${email ?? 'compte RelancePro'}`,
      `Code : ${code}`,
      '',
      'Ce code permet de réinitialiser votre mot de passe si vous le perdez.',
      "Il ne sera plus jamais affiché dans l'application.",
      "Conservez ce fichier hors de l'application et ne le partagez avec personne.",
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relancepro-code-recuperation.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy/75 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-code-title"
        id="recovery-code-print"
        className="w-full max-w-xl rounded-3xl border border-line bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="recovery-code-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold tracking-tight text-navy outline-none"
            >
              Votre code de récupération
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Il sera affiché <strong className="font-semibold text-navy">une seule fois</strong>.
              Sans lui, et sans session active, votre compte ne pourra pas être récupéré
              automatiquement.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            À conserver hors de l’application
          </p>
          <p className="mt-3 select-all break-all rounded-xl bg-white px-4 py-4 text-center font-mono text-lg font-bold tracking-[0.16em] text-navy">
            {code}
          </p>
          <p className="mt-3 text-xs leading-5 text-amber-800">
            Copiez-le, téléchargez-le ou imprimez-le maintenant. Nous ne pourrons plus vous
            l’afficher ensuite.
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" onClick={copyCode}>
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? 'Copié' : 'Copier'}
          </Button>
          <Button variant="secondary" onClick={downloadCode}>
            <Download className="size-4" aria-hidden="true" />
            Télécharger
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Imprimer
          </Button>
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-4 rounded border-line text-brand-blue focus:ring-brand-blue"
          />
          <span>
            J’ai enregistré ce code en lieu sûr. Je comprends qu’il ne sera plus jamais affiché.
          </span>
        </label>

        <div className="mt-5 flex justify-end">
          <Button onClick={onConfirm} disabled={!confirmed}>
            J’ai enregistré mon code, continuer
          </Button>
        </div>
      </section>
    </div>
  );
}
