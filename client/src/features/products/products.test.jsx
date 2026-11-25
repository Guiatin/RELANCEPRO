import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDetailPage from './ProductDetailPage.jsx';
import ProductFormPage from './ProductFormPage.jsx';
import ProductsPage from './ProductsPage.jsx';
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from './api.js';

vi.mock('./api.js', () => ({
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

const PRODUCT = {
  id: '7',
  companyId: '3',
  type: 'product',
  name: 'Chaise',
  description: 'Chaise en bois',
  unit: 'pièce',
  unitPrice: 1500,
  taxRate: '18.00',
  isActive: true,
  createdAt: '2026-11-24T10:00:00.000Z',
  updatedAt: '2026-11-24T10:00:00.000Z',
};

function renderList() {
  render(
    <MemoryRouter initialEntries={['/app/products']}>
      <Routes>
        <Route path="/app/products" element={<ProductsPage />} />
        <Route path="/app/products/nouveau" element={<p>Nouveau produit</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderCreateForm() {
  render(
    <MemoryRouter initialEntries={['/app/products/nouveau']}>
      <Routes>
        <Route path="/app/products/nouveau" element={<ProductFormPage />} />
        <Route path="/app/products/:id" element={<p>Fiche créée</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEditForm() {
  render(
    <MemoryRouter initialEntries={['/app/products/7/modifier']}>
      <Routes>
        <Route path="/app/products/:id/modifier" element={<ProductFormPage />} />
        <Route path="/app/products/:id" element={<p>Fiche mise à jour</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail() {
  render(
    <MemoryRouter initialEntries={['/app/products/7']}>
      <Routes>
        <Route path="/app/products" element={<p>Liste produits</p>} />
        <Route path="/app/products/:id" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProductsPage', () => {
  it('charge et affiche les produits avec les actions et la pagination', async () => {
    listProducts.mockResolvedValue({ data: [PRODUCT], meta: { page: 1, limit: 20, total: 1 } });

    renderList();

    expect((await screen.findAllByText('Chaise')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Produit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Actif').length).toBeGreaterThan(0);
    expect(listProducts).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(screen.getByText('Page 1 sur 1')).toBeInTheDocument();
  });

  it('affiche un état vide explicite', async () => {
    listProducts.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0 } });

    renderList();

    expect(await screen.findByText('Aucun produit pour le moment')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /nouveau produit/i }).length).toBeGreaterThan(0);
  });

  it('affiche une erreur avec une action de réessai', async () => {
    listProducts.mockRejectedValue({
      response: { data: { error: { message: 'Erreur réseau.' } } },
    });

    renderList();

    expect(await screen.findByText('Erreur réseau.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
  });

  it('transmet la recherche et les filtres à l’API', async () => {
    listProducts.mockResolvedValue({ data: [PRODUCT], meta: { page: 1, limit: 20, total: 1 } });
    const user = userEvent.setup();

    renderList();
    await screen.findAllByText('Chaise');

    await user.type(screen.getByLabelText('Rechercher'), 'chaise');
    await waitFor(
      () =>
        expect(listProducts).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'chaise' }),
        ),
      { timeout: 2000 },
    );

    await user.selectOptions(screen.getByLabelText('Type'), 'service');
    await waitFor(() =>
      expect(listProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'service', page: 1 }),
      ),
    );

    await user.selectOptions(screen.getByLabelText('Statut'), 'false');
    await waitFor(() =>
      expect(listProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: 'false', page: 1 }),
      ),
    );
  });

  it('confirme puis supprime un produit', async () => {
    listProducts.mockResolvedValue({ data: [PRODUCT], meta: { page: 1, limit: 20, total: 1 } });
    deleteProduct.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderList();
    await screen.findAllByText('Chaise');

    await user.click(screen.getAllByRole('button', { name: 'Supprimer Chaise' })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Chaise/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(deleteProduct).toHaveBeenCalledWith('7'));
    expect(await screen.findByText('Produit supprimé.')).toBeInTheDocument();
  });
});

describe('ProductFormPage', () => {
  it('valide le formulaire avant de créer le produit', async () => {
    createProduct.mockResolvedValue(PRODUCT);
    const user = userEvent.setup();

    renderCreateForm();

    await user.click(screen.getByRole('button', { name: /créer le produit/i }));

    expect(await screen.findByText('Le nom du produit est requis.')).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/nom/i), 'Chaise');
    await user.type(screen.getByLabelText(/prix unitaire/i), '1500');
    await user.click(screen.getByRole('button', { name: /créer le produit/i }));

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith({
        type: 'product',
        name: 'Chaise',
        description: null,
        unit: null,
        unit_price: 1500,
        tax_rate: '18',
        is_active: true,
      }),
    );
    expect(await screen.findByText('Fiche créée')).toBeInTheDocument();
  });

  it('refuse un prix non entier et un taux hors bornes', async () => {
    const user = userEvent.setup();

    renderCreateForm();

    await user.type(screen.getByLabelText(/nom/i), 'Chaise');
    await user.type(screen.getByLabelText(/prix unitaire/i), '12,5');
    await user.click(screen.getByRole('button', { name: /créer le produit/i }));

    expect(
      await screen.findByText('Le prix unitaire doit être un entier positif ou nul (FCFA).'),
    ).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('charge un produit existant puis enregistre les modifications', async () => {
    getProduct.mockResolvedValue(PRODUCT);
    updateProduct.mockResolvedValue(PRODUCT);
    const user = userEvent.setup();

    renderEditForm();

    expect(await screen.findByDisplayValue('Chaise')).toBeInTheDocument();

    const unit = screen.getByLabelText('Unité');
    await user.clear(unit);
    await user.type(unit, 'carton');
    await user.click(screen.getByRole('button', { name: /enregistrer les modifications/i }));

    await waitFor(() =>
      expect(updateProduct).toHaveBeenCalledWith(
        '7',
        expect.objectContaining({
          type: 'product',
          name: 'Chaise',
          unit: 'carton',
          unit_price: 1500,
        }),
      ),
    );
    expect(await screen.findByText('Fiche mise à jour')).toBeInTheDocument();
  });
});

describe('ProductDetailPage', () => {
  it('affiche la fiche complète et permet de supprimer le produit', async () => {
    getProduct.mockResolvedValue(PRODUCT);
    deleteProduct.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Chaise' })).toBeInTheDocument();
    expect(screen.getByText('Chaise en bois')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /modifier/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Supprimer' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Chaise/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(deleteProduct).toHaveBeenCalledWith('7'));
    expect(await screen.findByText('Liste produits')).toBeInTheDocument();
  });
});
