import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuoteDetailPage from './QuoteDetailPage.jsx';
import QuoteFormPage from './QuoteFormPage.jsx';
import QuotesPage from './QuotesPage.jsx';
import { createQuote, deleteQuote, getQuote, listQuotes, markQuoteSent } from './api.js';
import { listClients } from '../clients/api.js';
import { listProducts } from '../products/api.js';

vi.mock('./api.js', () => ({
  listQuotes: vi.fn(),
  getQuote: vi.fn(),
  createQuote: vi.fn(),
  updateQuote: vi.fn(),
  deleteQuote: vi.fn(),
  markQuoteSent: vi.fn(),
  changeQuoteStatus: vi.fn(),
}));

vi.mock('../clients/api.js', () => ({ listClients: vi.fn() }));
vi.mock('../products/api.js', () => ({ listProducts: vi.fn() }));

const ITEM = {
  id: '1',
  companyId: '3',
  quoteId: '8',
  productId: null,
  position: 0,
  description: 'Prestation',
  quantity: '2.00',
  unit: 'heure',
  unitPrice: 1000,
  discountRate: '0.00',
  taxRate: '18.00',
  taxExemptionCode: null,
  taxExemptionReason: null,
  lineSubtotal: 2000,
  lineDiscount: 0,
  lineTax: 360,
  lineTotal: 2360,
};

const QUOTE = {
  id: '8',
  companyId: '3',
  clientId: '5',
  clientName: 'Awa',
  number: 'DEV-2026-0001',
  status: 'sent',
  issueDate: '2026-11-26',
  validUntil: '2026-12-26',
  subtotal: 2000,
  discountTotal: 0,
  taxTotal: 360,
  total: 2360,
  notes: null,
  terms: null,
  clientReference: 'PO-1',
  sentAt: '2026-11-26T10:00:00.000Z',
  acceptedAt: null,
  createdAt: '2026-11-26T10:00:00.000Z',
  updatedAt: '2026-11-26T10:00:00.000Z',
  itemCount: 1,
  items: [ITEM],
};

const DRAFT = {
  ...QUOTE,
  number: null,
  status: 'draft',
  issueDate: null,
  sentAt: null,
};

function renderList() {
  render(
    <MemoryRouter initialEntries={['/app/quotes']}>
      <Routes>
        <Route path="/app/quotes" element={<QuotesPage />} />
        <Route path="/app/quotes/nouveau" element={<p>Nouveau devis</p>} />
        <Route path="/app/quotes/:id" element={<p>Fiche devis</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderCreateForm() {
  render(
    <MemoryRouter initialEntries={['/app/quotes/nouveau']}>
      <Routes>
        <Route path="/app/quotes/nouveau" element={<QuoteFormPage />} />
        <Route path="/app/quotes/:id" element={<p>Fiche créée</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail() {
  render(
    <MemoryRouter initialEntries={['/app/quotes/8']}>
      <Routes>
        <Route path="/app/quotes" element={<p>Liste devis</p>} />
        <Route path="/app/quotes/:id" element={<QuoteDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listClients.mockResolvedValue({ data: [{ id: '5', name: 'Awa' }], meta: { total: 1 } });
  listProducts.mockResolvedValue({ data: [], meta: { total: 0 } });
});

describe('QuotesPage', () => {
  it('affiche les devis avec leur numéro, statut et total', async () => {
    listQuotes.mockResolvedValue({ data: [QUOTE], meta: { page: 1, limit: 20, total: 1 } });

    renderList();

    expect((await screen.findAllByText('DEV-2026-0001')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Awa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Envoyé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 360 FCFA').length).toBeGreaterThan(0);
  });

  it('affiche un état vide et permet de créer un devis', async () => {
    listQuotes.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0 } });

    renderList();

    expect(await screen.findByText('Aucun devis pour le moment')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /nouveau devis/i }).length).toBeGreaterThan(0);
  });

  it('supprime un brouillon après confirmation', async () => {
    listQuotes.mockResolvedValue({ data: [DRAFT], meta: { page: 1, limit: 20, total: 1 } });
    deleteQuote.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderList();
    await screen.findByText('Brouillon');

    await user.click(screen.getAllByRole('button', { name: 'Supprimer le devis 8' })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(deleteQuote).toHaveBeenCalledWith('8'));
    expect(await screen.findByText('Devis supprimé.')).toBeInTheDocument();
  });
});

describe('QuoteFormPage', () => {
  it('valide le client puis crée un devis avec une ligne', async () => {
    createQuote.mockResolvedValue({ id: '9' });
    const user = userEvent.setup();

    renderCreateForm();

    await user.click(screen.getByRole('button', { name: /créer le devis/i }));
    expect(await screen.findByText('Sélectionnez un client.')).toBeInTheDocument();
    expect(createQuote).not.toHaveBeenCalled();

    await screen.findByRole('option', { name: 'Awa' });
    await user.selectOptions(screen.getByLabelText('Client *'), '5');

    await user.click(screen.getByRole('button', { name: /ajouter une ligne/i }));
    await user.type(screen.getByLabelText('Description *'), 'Prestation');
    await user.type(screen.getByLabelText('Prix unitaire (FCFA) *'), '1500');

    await user.click(screen.getByRole('button', { name: /créer le devis/i }));

    await waitFor(() =>
      expect(createQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: '5',
          client_reference: null,
          valid_until: null,
          items: [
            expect.objectContaining({
              product_id: null,
              description: 'Prestation',
              quantity: '1',
              unit_price: 1500,
              discount_rate: '0',
              tax_rate: '18',
            }),
          ],
        }),
      ),
    );
    expect(await screen.findByText('Fiche créée')).toBeInTheDocument();
  });
});

describe('QuoteDetailPage', () => {
  it('envoie un brouillon et affiche le numéro attribué', async () => {
    getQuote.mockResolvedValue(DRAFT);
    markQuoteSent.mockResolvedValue({ ...DRAFT, status: 'sent', number: 'DEV-2026-0001' });
    const user = userEvent.setup();

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Awa' })).toBeInTheDocument();
    expect(screen.getByText('Prestation')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /envoyer/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(markQuoteSent).toHaveBeenCalledWith('8'));
    expect(
      await screen.findByText('Devis envoyé sous le numéro DEV-2026-0001.'),
    ).toBeInTheDocument();
  });
});
