import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { useAuthStore } from '../../stores/authStore';
import { RegisterPage } from './RegisterPage';

function renderRegister() {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/boards" element={<div>Mis tableros</div>} />
    </Routes>,
    { route: '/register' },
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre'), 'Grace Hopper');
  await user.type(screen.getByLabelText('Email'), 'grace@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'una-contraseña-larga');
}

describe('RegisterPage', () => {
  it('muestra errores de validación con datos inválidos y no envía la petición', async () => {
    let requests = 0;
    server.use(
      http.post('/api/auth/register', () => {
        requests += 1;
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText('Email'), 'no-es-un-email');
    await user.type(screen.getByLabelText('Contraseña'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('Email inválido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña debe tener al menos 10 caracteres')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toBe(0);
  });

  it('con datos válidos crea la cuenta, guarda la sesión y navega a /boards', async () => {
    const user = userEvent.setup();
    renderRegister();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Mis tableros')).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'test-access-token',
      user: { email: 'grace@example.com' },
    });
  });

  it('muestra el mensaje del servidor si el email ya existe', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Ya existe una cuenta con ese email' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderRegister();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya existe una cuenta con ese email',
    );
    expect(screen.queryByText('Mis tableros')).not.toBeInTheDocument();
  });
});
