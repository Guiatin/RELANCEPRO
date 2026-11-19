import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from './Input.jsx';

export default function PasswordInput({ label = 'Mot de passe', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      label={label}
      type={visible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-app hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      }
    />
  );
}
