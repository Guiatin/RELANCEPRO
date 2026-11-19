import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context.js';
import FullPageLoader from '../ui/FullPageLoader.jsx';

export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }

  return children;
}
