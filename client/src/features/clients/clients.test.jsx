import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClientDetailPage from './ClientDetailPage.jsx';
import ClientFormPage from './ClientFormPage.jsx';
import ClientsPage from './ClientsPage.jsx';
import { createClient, deleteClient, getClient, listClients, updateClient } from './api.js';

vi.mock('./api.js', () => ({
  listClients: vi.fn(),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));

const CLIENT = {
  id: '42',
  companyId: '3',
  name: 'Awa Traoré',
  contactName: 'Kadi',
  email: 'awa@example.com',
  phone: '+22670000000',
  whatsapp: null,
  address: 'Rue 12',
  city: 'Ouagadougou',
  notes: 'Client fidèle',
  isActive: true,
  createdAt: '2026-11-21T10:00:00.000Z',
  updatedAt: '2026-11-22T10:00:00.000Z',
};

function renderList() {
  render(
    <MemoryRouter initialEntries={['/app/clients']}>
      <Routes>
        <Route path="/app/clients" element={<ClientsPage />} />
        <Route path="/app/clients/nouveau" element={<p>Nouveau client</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderCreateForm() {
  render(
    <MemoryRouter initialEntries={['/app/clients/nouveau']}>
      <Routes>
        <Route path="/app/clients/nouveau" element={<ClientFormPage />} />
        <Route path="/app/clients/:id" element={<p>Fiche créée</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEditForm() {
  render(
    <MemoryRouter initialEntries={['/app/clients/42/modifier']}>
      <Routes>
        <Route path="/app/clients/:id/modifier" element={<ClientFormPage />} />
        <Route path="/app/clients/:id" element={<p>Fiche mise à jour</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail() {
  render(
    <MemoryRouter initialEntries={['/app/clients/42']}>
      <Routes>
        <Route path="/app/clients" element={<p>Liste clients</p>} />
        <Route path="/app/clients/:id" element={<ClientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ClientsPage', () => {
  it('charge et affiche les clients avec les actions et la pagination', async () => {
    listClients.mockResolvedValue({ data: [CLIENT], meta: { page: 1, limit: 20, total: 1 } });

    renderList();

    expect((await screen.findAllByText('Awa Traoré')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Actif').length).toBeGreaterThan(0);
    expect(screen.getAllByText('awa@example.com').length).toBeGreaterThan(0);
    expect(listClients).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(screen.getByText('Page 1 sur 1')).toBeInTheDocument();
  });

  it('affiche un état vide explicite', async () => {
    listClients.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0 } });

    renderList();

    expect(await screen.findByText('Aucun client pour le moment')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /nouveau client/i }).length).toBeGreaterThan(0);
  });

  it('affiche une erreur avec une action de réessai', async () => {
    listClients.mockRejectedValue({
      response: { data: { error: { message: 'Erreur réseau.' } } },
    });

    renderList();

    expect(await screen.findByText('Erreur réseau.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
  });

  it('transmet la recherche et le filtre de statut à l’API', async () => {
    listClients.mockResolvedValue({ data: [CLIENT], meta: { page: 1, limit: 20, total: 1 } });
    const user = userEvent.setup();

    renderList();
    await screen.findAllByText('Awa Traoré');

    await user.type(screen.getByLabelText('Rechercher'), 'awa');
    await waitFor(
      () =>
        expect(listClients).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'awa' })),
      { timeout: 2000 },
    );

    await user.selectOptions(screen.getByLabelText('Statut'), 'false');
    await waitFor(() =>
      expect(listClients).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: 'false', page: 1 }),
      ),
    );
  });

  it('confirme puis supprime un client', async () => {
    listClients.mockResolvedValue({ data: [CLIENT], meta: { page: 1, limit: 20, total: 1 } });
    deleteClient.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderList();
    await screen.findAllByText('Awa Traoré');

    await user.click(screen.getAllByRole('button', { name: 'Supprimer Awa Traoré' })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Awa Traoré/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(deleteClient).toHaveBeenCalledWith('42'));
    expect(await screen.findByText('Client supprimé.')).toBeInTheDocument();
  });
});

describe('ClientFormPage', () => {
  it('valide le formulaire avant de créer le client', async () => {
    createClient.mockResolvedValue(CLIENT);
    const user = userEvent.setup();

    renderCreateForm();

    await user.click(screen.getByRole('button', { name: /créer le client/i }));

    expect(await screen.findByText('Le nom du client est requis.')).toBeInTheDocument();
    expect(createClient).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/nom du client/i), 'Awa Traoré');
    await user.click(screen.getByRole('button', { name: /créer le client/i }));

    await waitFor(() =>
      expect(createClient).toHaveBeenCalledWith({ name: 'Awa Traoré', is_active: true }),
    );
    expect(await screen.findByText('Fiche créée')).toBeInTheDocument();
  });

  it('charge un client existant puis enregistre les modifications', async () => {
    getClient.mockResolvedValue(CLIENT);
    updateClient.mockResolvedValue(CLIENT);
    const user = userEvent.setup();

    renderEditForm();

    expect(await screen.findByDisplayValue('Awa Traoré')).toBeInTheDocument();

    const city = screen.getByLabelText('Ville');
    await user.clear(city);
    await user.type(city, 'Bobo-Dioulasso');
    await user.click(screen.getByRole('button', { name: /enregistrer les modifications/i }));

    await waitFor(() =>
      expect(updateClient).toHaveBeenCalledWith(
        '42',
        expect.objectContaining({
          name: 'Awa Traoré',
          city: 'Bobo-Dioulasso',
          is_active: true,
        }),
      ),
    );
    expect(await screen.findByText('Fiche mise à jour')).toBeInTheDocument();
  });
});

describe('ClientDetailPage', () => {
  it('affiche la fiche complète et permet de supprimer le client', async () => {
    getClient.mockResolvedValue(CLIENT);
    deleteClient.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Awa Traoré' })).toBeInTheDocument();
    expect(screen.getByText('awa@example.com')).toBeInTheDocument();
    expect(screen.getByText('Client fidèle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /modifier/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Supprimer' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Awa Traoré/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(deleteClient).toHaveBeenCalledWith('42'));
    expect(await screen.findByText('Liste clients')).toBeInTheDocument();
  });
});
