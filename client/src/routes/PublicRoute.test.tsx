import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/test-utils';
import { useAuthStore } from '../stores/authStore';
import { TEST_USER } from '../test/handlers';
import { PublicRoute } from './PublicRoute';

function renderLoginRoute() {
  return renderWithProviders(
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<div>Formulario de login</div>} />
      </Route>
      <Route path="/boards" element={<div>Mis tableros</div>} />
    </Routes>,
    { route: '/login' },
  );
}

describe('PublicRoute', () => {
  it('sin sesión muestra la página pública', () => {
    renderLoginRoute();
    expect(screen.getByText('Formulario de login')).toBeInTheDocument();
  });

  it('con sesión redirige a /boards', () => {
    useAuthStore.setState({ status: 'authenticated', user: TEST_USER, accessToken: 't' });
    renderLoginRoute();
    expect(screen.getByText('Mis tableros')).toBeInTheDocument();
  });
});
