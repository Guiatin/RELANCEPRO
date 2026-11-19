import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../context/auth-context.js';
import LoginPage from './LoginPage.jsx';

function renderPage(login) {
  render(
    <MemoryRouter initialEntries={['/connexion']}>
      <AuthContext.Provider value={{ login }}>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/app" element={<p>Espace authentifié</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('affiche les erreurs de validation sans appeler l’API', async () => {
    const login = vi.fn();
    const user = userEvent.setup();
    renderPage(login);

    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(screen.getByText('Email invalide.')).toBeInTheDocument();
    expect(screen.getByText('Mot de passe requis.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('normalise l’email, connecte et redirige vers l’espace', async () => {
    const login = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderPage(login);

    await user.type(screen.getByLabelText('Email'), 'AWA@EXAMPLE.COM');
    await user.type(screen.getByLabelText('Mot de passe'), 'MotDePasse!42');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'awa@example.com',
        password: 'MotDePasse!42',
      });
    });

    expect(await screen.findByText('Espace authentifié')).toBeInTheDocument();
  });

  it('affiche le message générique en cas d’échec', async () => {
    const login = vi.fn().mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Email ou mot de passe incorrect.',
          },
        },
      },
    });
    const user = userEvent.setup();
    renderPage(login);

    await user.type(screen.getByLabelText('Email'), 'awa@example.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'Mauvais!42');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(await screen.findByText('Email ou mot de passe incorrect.')).toBeInTheDocument();
  });
});
