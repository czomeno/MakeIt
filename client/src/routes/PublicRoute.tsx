import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

// /login y /register: si ya hay sesión, no tienen sentido.
export function PublicRoute() {
  const status = useAuthStore((state) => state.status);

  if (status === 'authenticated') {
    return <Navigate to="/boards" replace />;
  }

  return <Outlet />;
}
