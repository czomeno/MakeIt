import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/test-utils';
import { LoginPage } from './LoginPage';
import { TEST_PASSWORD } from '../../test/handlers';

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/boards" element={<div>Mis tableros</div>} />
    </Routes>,
    { route: '/login' },
  );
}

describe('LoginPage', () => {
  it('inicia sesión con credenciales correctas y navega a /boards', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Contraseña'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Mis tableros')).toBeInTheDocument();
  });

  it('muestra un error genérico con credenciales incorrectas', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
    expect(screen.queryByText('Mis tableros')).not.toBeInTheDocument();
  });
});
