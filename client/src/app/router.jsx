import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout.jsx';
import ProtectedRoute from '../components/routing/ProtectedRoute.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import RegisterPage from '../features/auth/RegisterPage.jsx';
import ResetPasswordPage from '../features/auth/ResetPasswordPage.jsx';
import NotFoundPage from '../features/auth/NotFoundPage.jsx';
import DashboardPage from '../features/dashboard/DashboardPage.jsx';
import ClientsPage from '../features/clients/ClientsPage.jsx';
import ClientDetailPage from '../features/clients/ClientDetailPage.jsx';
import ClientFormPage from '../features/clients/ClientFormPage.jsx';
import ProductsPage from '../features/products/ProductsPage.jsx';
import ProductDetailPage from '../features/products/ProductDetailPage.jsx';
import ProductFormPage from '../features/products/ProductFormPage.jsx';
import QuotesPage from '../features/quotes/QuotesPage.jsx';
import QuoteDetailPage from '../features/quotes/QuoteDetailPage.jsx';
import QuoteFormPage from '../features/quotes/QuoteFormPage.jsx';
import SecurityPage from '../features/settings/SecurityPage.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app" replace />,
  },
  {
    path: '/connexion',
    element: <LoginPage />,
  },
  {
    path: '/inscription',
    element: <RegisterPage />,
  },
  {
    path: '/mot-de-passe-oublie',
    element: <ResetPasswordPage />,
  },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/nouveau', element: <ClientFormPage /> },
      { path: 'clients/:id', element: <ClientDetailPage /> },
      { path: 'clients/:id/modifier', element: <ClientFormPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/nouveau', element: <ProductFormPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      { path: 'products/:id/modifier', element: <ProductFormPage /> },
      { path: 'quotes', element: <QuotesPage /> },
      { path: 'quotes/nouveau', element: <QuoteFormPage /> },
      { path: 'quotes/:id', element: <QuoteDetailPage /> },
      { path: 'quotes/:id/modifier', element: <QuoteFormPage /> },
      { path: 'parametres', element: <Navigate to="/app/parametres/securite" replace /> },
      { path: 'parametres/securite', element: <SecurityPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
