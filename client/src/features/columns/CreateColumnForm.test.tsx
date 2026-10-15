import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { Toaster } from '../../components/Toaster';
import { CreateColumnForm } from './CreateColumnForm';

function renderForm() {
  return renderWithProviders(
    <>
      <CreateColumnForm boardId="board-1" />
      <Toaster />
    </>,
  );
}

describe('CreateColumnForm', () => {
  it('crea la columna con el título recortado y vacía el campo', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/boards/:boardId/columns', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ column: { _id: 'col-9' } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText('Nueva columna');
    await user.type(input, '  En revisión  ');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await expect.poll(() => bodies).toEqual([{ title: 'En revisión' }]);
    await expect.poll(() => (input as HTMLInputElement).value).toBe('');
  });

  it('no envía nada si el título está vacío', async () => {
    let calls = 0;
    server.use(
      http.post('/api/boards/:boardId/columns', () => {
        calls += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Nueva columna'), '   ');
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    expect(calls).toBe(0);
  });

  it('muestra el error del servidor y conserva lo escrito', async () => {
    server.use(
      http.post('/api/boards/:boardId/columns', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'No tienes permisos suficientes' } },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Nueva columna'), 'Bloqueado');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    expect(await screen.findByText('No tienes permisos suficientes')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva columna')).toHaveValue('Bloqueado');
  });
});
