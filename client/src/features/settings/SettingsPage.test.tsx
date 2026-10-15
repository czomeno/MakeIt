import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useToastStore } from '../../stores/toastStore';
import { TEST_USER } from '../../test/handlers';
import { SettingsPage } from './SettingsPage';

function renderSettings() {
  useAuthStore.setState({ status: 'authenticated', user: TEST_USER, accessToken: 'token' });
  renderWithProviders(<SettingsPage />, { route: '/settings' });
}

async function fillPasswordForm(current: string, next: string, confirm = next) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Contraseña actual'), current);
  await user.type(screen.getByLabelText('Contraseña nueva'), next);
  await user.type(screen.getByLabelText('Repite la contraseña nueva'), confirm);
  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

describe('SettingsPage', () => {
  it('el interruptor de tema está en Visualización y cambia el tema', async () => {
    const user = userEvent.setup();
    useThemeStore.getState().setTheme('light');
    renderSettings();

    const section = screen.getByRole('region', { name: 'Visualización' });
    const toggle = screen.getByRole('switch', { name: 'Cambiar entre tema claro y oscuro' });
    expect(section).toContainElement(toggle);

    await user.click(toggle);
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('cambia la contraseña, guarda el token nuevo y vacía el formulario', async () => {
    let sentBody: unknown;
    server.use(
      http.post('/api/auth/password', async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({ accessToken: 'token-nuevo' });
      }),
    );
    renderSettings();

    await fillPasswordForm('password123456', 'una-clave-nueva');

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContainEqual(
        expect.stringMatching(/Contraseña cambiada/),
      ),
    );
    expect(sentBody).toEqual({ currentPassword: 'password123456', newPassword: 'una-clave-nueva' });
    expect(useAuthStore.getState().accessToken).toBe('token-nuevo');
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
  });

  it('marca la contraseña actual si el servidor la rechaza, sin cerrar la sesión', async () => {
    server.use(
      http.post('/api/auth/password', () =>
        HttpResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'La contraseña actual no es correcta' } },
          { status: 400 },
        ),
      ),
    );
    renderSettings();

    await fillPasswordForm('incorrecta', 'una-clave-nueva');

    expect(await screen.findByText('La contraseña actual no es correcta')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('aria-invalid', 'true');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('valida en el cliente: longitud, coincidencia y distinta de la actual', async () => {
    renderSettings();

    await fillPasswordForm('password123456', 'corta', 'otra');
    expect(
      await screen.findByText('La contraseña debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('no deja poner la misma contraseña', async () => {
    renderSettings();

    await fillPasswordForm('password123456', 'password123456');
    expect(
      await screen.findByText('La contraseña nueva debe ser distinta de la actual'),
    ).toBeInTheDocument();
  });
});
