import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { NotFoundPage } from './NotFoundPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { BoardsListPage } from '../features/boards/BoardsListPage';
import { BoardPage } from '../features/boards/BoardPage';
import { AcceptInvitePage } from '../features/members/AcceptInvitePage';
import { AppLayout } from '../components/AppLayout';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        {/* Fuera de AppLayout: pantalla centrada propia, como login/register. */}
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
        <Route element={<AppLayout />}>
          <Route path="/boards" element={<BoardsListPage />} />
          <Route path="/boards/:id" element={<BoardPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/boards" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
