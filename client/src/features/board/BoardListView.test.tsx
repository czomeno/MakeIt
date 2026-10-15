import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { createTestQueryClient, renderWithProviders } from '../../test/test-utils';
import { makeBoard, makeCard } from '../../test/fixtures';
import { boardsKeys } from '../boards/hooks';
import { BoardListView } from './BoardListView';
import type { BoardWithContent } from '../../types/api';

function renderList(board: BoardWithContent, canEdit = true) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(boardsKeys.detail(board._id), board);
  const onOpenCard = vi.fn();
  renderWithProviders(<BoardListView board={board} canEdit={canEdit} onOpenCard={onOpenCard} />, {
    queryClient,
  });
  return { queryClient, onOpenCard };
}

describe('BoardListView', () => {
  it('mueve una tarjeta a otra columna con el botón de categoría', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/cards/:id/move', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ card: makeCard('a', 'col-2') });
      }),
      http.get('/api/boards/:id', () => HttpResponse.json({ board: makeBoard() })),
    );
    const user = userEvent.setup();
    const board = makeBoard([makeCard('a', 'col-1', { title: 'Escribir tests' })]);
    renderList(board);

    const group = screen.getByRole('group', { name: 'Categoría de "Escribir tests"' });
    expect(within(group).getByRole('button', { name: 'Por hacer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(group).getByRole('button', { name: 'Hecho' }));

    await expect.poll(() => bodies).toEqual([{ columnId: 'col-2' }]);
  });

  it('añade una tarjeta en la categoría elegida', async () => {
    const created: { columnId: string; body: unknown }[] = [];
    server.use(
      http.post('/api/columns/:columnId/cards', async ({ params, request }) => {
        created.push({ columnId: String(params.columnId), body: await request.json() });
        return HttpResponse.json({ card: makeCard('n', String(params.columnId)) }, { status: 201 });
      }),
      http.get('/api/boards/:id', () => HttpResponse.json({ board: makeBoard() })),
    );
    const user = userEvent.setup();
    renderList(makeBoard());

    await user.type(screen.getByLabelText('Nueva tarea o solicitud'), 'Nueva');
    await user.selectOptions(screen.getByLabelText('Categoría inicial'), 'Hecho');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));

    await expect.poll(() => created).toEqual([{ columnId: 'col-2', body: { title: 'Nueva' } }]);
  });

  it('abre el detalle al pulsar una tarjeta', async () => {
    const user = userEvent.setup();
    const card = makeCard('a', 'col-1', { title: 'Abrir' });
    const { onOpenCard } = renderList(makeBoard([card]));
    await user.click(screen.getByRole('button', { name: /Abrir/ }));
    expect(onOpenCard).toHaveBeenCalledWith(card);
  });

  it('un lector no ve el formulario y los botones de categoría están deshabilitados', () => {
    renderList(makeBoard([makeCard('a', 'col-1', { title: 'Solo lectura' })]), false);
    expect(screen.queryByLabelText('Nueva tarea o solicitud')).not.toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Categoría de "Solo lectura"' });
    expect(within(group).getByRole('button', { name: 'Hecho' })).toBeDisabled();
  });

  it('estados vacíos: sin tarjetas y sin categorías', () => {
    renderList(makeBoard([]));
    expect(screen.getByText('No hay tarjetas todavía')).toBeInTheDocument();
  });

  it('sin columnas, invita a crear una categoría primero', () => {
    renderList(makeBoard([], { columns: [] }));
    expect(screen.getByText('Este tablero todavía no tiene categorías')).toBeInTheDocument();
  });
});
