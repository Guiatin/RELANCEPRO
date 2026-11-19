import { RouterProvider } from 'react-router-dom';
import { router } from './app/router.jsx';
import { AuthProvider } from './context/AuthProvider.jsx';

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
