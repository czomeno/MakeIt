import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { Toaster } from '../../components/Toaster';
import { makeBoard } from '../../test/fixtures';
import { EditBoardModal } from './EditBoardModal';

function renderModal() {
  const onClose = vi.fn();
  renderWithProviders(
    <>
      <EditBoardModal
        board={makeBoard([], { title: 'Mi tablero', description: 'Notas' })}
        isOpen
        onClose={onClose}
      />
      <Toaster />
    </>,
  );
  return { onClose };
}

describe('EditBoardModal', () => {
  it('precarga los datos y guarda los cambios', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/boards/:id', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ board: makeBoard() });
      }),
    );
    const user = userEvent.setup();
    const { onClose } = renderModal();

    const title = screen.getByLabelText('Título');
    expect(title).toHaveValue('Mi tablero');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Notas');
    await user.clear(title);
    await user.type(title, 'Renombrado');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Tablero actualizado.')).toBeInTheDocument();
    expect(bodies).toEqual([{ title: 'Renombrado', description: 'Notas' }]);
    expect(onClose).toHaveBeenCalled();
  });

  it('valida que el título no quede vacío', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.clear(screen.getByLabelText('Título'));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('El título es obligatorio')).toBeInTheDocument();
  });

  it('si el servidor falla, muestra el error y no cierra', async () => {
    server.use(
      http.patch('/api/boards/:id', () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Fallo' } }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.type(screen.getByLabelText('Título'), '!');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Fallo')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
