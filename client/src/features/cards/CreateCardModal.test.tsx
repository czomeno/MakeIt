import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { makeBoard, makeCard } from '../../test/fixtures';
import { useToastStore } from '../../stores/toastStore';
import { CreateCardModal } from './CreateCardModal';
import type { BoardWithContent } from '../../types/api';

function mockCreate() {
  const created: { columnId: string; body: unknown }[] = [];
  server.use(
    http.post('/api/columns/:columnId/cards', async ({ params, request }) => {
      created.push({ columnId: String(params.columnId), body: await request.json() });
      return HttpResponse.json({ card: makeCard('n', String(params.columnId)) }, { status: 201 });
    }),
    http.get('/api/boards/:id', () => HttpResponse.json({ board: makeBoard() })),
  );
  return created;
}

function renderModal(board: BoardWithContent = makeBoard()) {
  const onClose = vi.fn();
  renderWithProviders(<CreateCardModal board={board} isOpen onClose={onClose} />);
  return { onClose, dialog: screen.getByRole('dialog') };
}

describe('CreateCardModal', () => {
  it('crea una tarea con todos sus detalles y se cierra', async () => {
    const created = mockCreate();
    const user = userEvent.setup();
    const { onClose, dialog } = renderModal();
    expect(dialog).toHaveAccessibleName('Nueva tarea');
    expect(within(dialog).queryByLabelText('Empresa')).toBeNull();

    await user.type(within(dialog).getByLabelText('Título'), 'Preparar la demo');
    await user.click(within(dialog).getByRole('button', { name: 'Categoría Por hacer' }));
    await user.click(screen.getByRole('option', { name: 'Hecho' }));
    await user.click(within(dialog).getByRole('button', { name: 'Prioridad Sin prioridad' }));
    await user.click(screen.getByRole('option', { name: 'Alta' }));
    await user.type(within(dialog).getByLabelText('Fecha límite'), '2026-10-20');
    await user.type(within(dialog).getByLabelText('Descripción'), 'Con capturas');
    await user.type(within(dialog).getByLabelText('Etiquetas'), 'demo, cliente');
    await user.click(within(dialog).getByRole('button', { name: 'Añadir tarea' }));

    await expect
      .poll(() => created)
      .toEqual([
        {
          columnId: 'col-2',
          body: {
            title: 'Preparar la demo',
            description: 'Con capturas',
            labels: ['demo', 'cliente'],
            dueDate: '2026-10-20',
            priority: 'high',
          },
        },
      ]);
    await expect.poll(() => onClose.mock.calls.length).toBe(1);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
      'Tarea añadida.',
    );
  });

  it('con solo el título basta (va a la primera categoría)', async () => {
    const created = mockCreate();
    const user = userEvent.setup();
    const { dialog } = renderModal();

    await user.type(within(dialog).getByLabelText('Título'), 'Rápida');
    await user.click(within(dialog).getByRole('button', { name: 'Añadir tarea' }));

    await expect.poll(() => created).toEqual([{ columnId: 'col-1', body: { title: 'Rápida' } }]);
  });

  it('candidatura: pide puesto, empresa y enlace de la oferta', async () => {
    const created = mockCreate();
    const user = userEvent.setup();
    const { dialog } = renderModal(makeBoard([], { template: 'job-applications' }));
    expect(dialog).toHaveAccessibleName('Nueva candidatura');

    await user.type(within(dialog).getByLabelText('Puesto'), 'Frontend');
    await user.type(within(dialog).getByLabelText('Empresa'), 'Acme');
    await user.type(within(dialog).getByLabelText('Enlace de la oferta'), 'https://acme.dev/job');
    await user.click(within(dialog).getByRole('button', { name: 'Añadir candidatura' }));

    await expect
      .poll(() => created)
      .toEqual([
        {
          columnId: 'col-1',
          body: { title: 'Frontend', company: 'Acme', jobUrl: 'https://acme.dev/job' },
        },
      ]);
  });

  it('valida el título y la URL sin enviar nada', async () => {
    const created = mockCreate();
    const user = userEvent.setup();
    const { dialog } = renderModal(makeBoard([], { template: 'job-applications' }));

    await user.type(within(dialog).getByLabelText('Enlace de la oferta'), 'no-es-url');
    await user.click(within(dialog).getByRole('button', { name: 'Añadir candidatura' }));

    expect(await within(dialog).findByText('El título es obligatorio')).toBeInTheDocument();
    expect(within(dialog).getByText('URL inválida')).toBeInTheDocument();
    expect(created).toEqual([]);
  });

  it('si falla, avisa y no se cierra', async () => {
    server.use(
      http.post('/api/columns/:columnId/cards', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'No autorizado' } },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { onClose, dialog } = renderModal();

    await user.type(within(dialog).getByLabelText('Título'), 'X');
    await user.click(within(dialog).getByRole('button', { name: 'Añadir tarea' }));

    await expect
      .poll(() => useToastStore.getState().toasts.map((toast) => toast.message))
      .toContain('No autorizado');
    expect(onClose).not.toHaveBeenCalled();
  });
});
