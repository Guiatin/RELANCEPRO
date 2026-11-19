import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../context/auth-context.js';
import RegisterPage from './RegisterPage.jsx';

const RECOVERY_CODE = 'ABCDE-FGHJK-MNPQR-STVWX';

function renderPage(register) {
  render(
    <MemoryRouter initialEntries={['/inscription']}>
      <AuthContext.Provider value={{ register }}>
        <Routes>
          <Route path="/inscription" element={<RegisterPage />} />
          <Route path="/app" element={<p>Espace authentifié</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  it('crée le compte, affiche le code une fois et confirme avant de continuer', async () => {
    const register = vi.fn().mockResolvedValue({
      user: { email: 'awa@example.com' },
      recovery_code: RECOVERY_CODE,
    });
    const user = userEvent.setup();
    renderPage(register);

    await user.type(screen.getByLabelText('Nom de l’entreprise'), 'Acme SARL');
    await user.type(screen.getByLabelText('Votre nom complet'), 'Awa Traoré');
    await user.type(screen.getByLabelText('Email'), 'awa@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'MotDePasse!42');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'MotDePasse!42');

    await user.click(screen.getByRole('button', { name: /créer mon espace/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(RECOVERY_CODE)).toBeInTheDocument();

    expect(register).toHaveBeenCalledWith({
      company_name: 'Acme SARL',
      full_name: 'Awa Traoré',
      email: 'awa@example.com',
      password: 'MotDePasse!42',
    });

    const confirm = screen.getByRole('button', {
      name: /enregistré mon code, continuer/i,
    });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    await user.click(confirm);

    expect(await screen.findByText('Espace authentifié')).toBeInTheDocument();
  });
});
