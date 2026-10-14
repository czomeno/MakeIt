import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/test-utils';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '../stores/authStore';

describe('ProtectedRoute', () => {
  it('redirige a /login si no hay sesión', () => {
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/boards" element={<div>Mis tableros</div>} />
        </Route>
        <Route path="/login" element={<div>Iniciar sesión</div>} />
      </Routes>,
      { route: '/boards' },
    );

    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
    expect(screen.queryByText('Mis tableros')).not.toBeInTheDocument();
  });

  it('renderiza la ruta si hay sesión', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: '1', name: 'Ada', email: 'ada@example.com', createdAt: '2024-01-01' },
      accessToken: 'token',
    });

    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/boards" element={<div>Mis tableros</div>} />
        </Route>
        <Route path="/login" element={<div>Iniciar sesión</div>} />
      </Routes>,
      { route: '/boards' },
    );

    expect(screen.getByText('Mis tableros')).toBeInTheDocument();
  });
});
