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

  it('abre el detalle al pulsar una tarjeta', async () => {
    const user = userEvent.setup();
    const card = makeCard('a', 'col-1', { title: 'Abrir' });
    const { onOpenCard } = renderList(makeBoard([card]));
    await user.click(screen.getByRole('button', { name: /Abrir/ }));
    expect(onOpenCard).toHaveBeenCalledWith(card);
  });

  it('para un lector los botones de categoría están deshabilitados', () => {
    renderList(makeBoard([makeCard('a', 'col-1', { title: 'Solo lectura' })]), false);
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

  it('marca una tarea como hecha al instante y lo guarda', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/cards/:id', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ card: makeCard('a', 'col-1', { completed: true }) });
      }),
      http.get('/api/boards/:id', () =>
        HttpResponse.json({
          board: makeBoard([makeCard('a', 'col-1', { title: 'Enviar CV', completed: true })]),
        }),
      ),
    );
    const user = userEvent.setup();
    const { queryClient } = renderList(makeBoard([makeCard('a', 'col-1', { title: 'Enviar CV' })]));

    await user.click(screen.getByRole('checkbox', { name: 'Marcar «Enviar CV» como hecha' }));

    const cached = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail('board-1'));
    expect(cached?.columns[0]?.cards[0]?.completed).toBe(true);
    await expect.poll(() => bodies).toEqual([{ completed: true }]);
  });

  it('si falla al marcarla como hecha, deshace el cambio', async () => {
    server.use(
      http.patch('/api/cards/:id', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'fallo' } }, { status: 500 }),
      ),
      http.get('/api/boards/:id', () =>
        HttpResponse.json({ board: makeBoard([makeCard('a', 'col-1', { title: 'Enviar CV' })]) }),
      ),
    );
    const user = userEvent.setup();
    const { queryClient } = renderList(makeBoard([makeCard('a', 'col-1', { title: 'Enviar CV' })]));

    await user.click(screen.getByRole('checkbox', { name: 'Marcar «Enviar CV» como hecha' }));

    await expect
      .poll(
        () =>
          queryClient.getQueryData<BoardWithContent>(boardsKeys.detail('board-1'))?.columns[0]
            ?.cards[0]?.completed,
      )
      .not.toBe(true);
  });

  it('muestra la prioridad y la fecha de cada tarea', () => {
    renderList(
      makeBoard([
        makeCard('a', 'col-1', {
          title: 'Entrevista',
          priority: 'high',
          dueDate: '2026-10-16T00:00:00.000Z',
        }),
      ]),
    );
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('Alta')).toBeInTheDocument();
    expect(within(row).getByText('16 oct')).toBeInTheDocument();
  });

  describe('búsqueda y filtros', () => {
    const today = new Date();
    const key = (offset: number) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}T00:00:00.000Z`;
    };

    function renderFilterBoard() {
      const board = makeBoard([
        makeCard('a', 'col-1', {
          title: 'Preparar entrevista',
          priority: 'high',
          company: 'Acme',
          dueDate: key(0),
        }),
        makeCard('b', 'col-1', {
          title: 'Actualizar portfolio',
          priority: 'low',
          labels: ['diseño'],
          dueDate: key(-3),
        }),
        makeCard('c', 'col-1', { title: 'Leer documentación' }),
      ]);
      board.columns[1]!.cards = [
        makeCard('d', 'col-2', { title: 'Enviar solicitud', priority: 'medium', dueDate: key(5) }),
      ];
      renderList(board);
    }

    function visibleTitles() {
      return screen
        .getAllByRole('listitem')
        .map((item) => within(item).getAllByRole('button')[0]!.textContent);
    }

    it('busca por título, empresa y etiquetas', async () => {
      const user = userEvent.setup();
      renderFilterBoard();

      await user.type(screen.getByRole('searchbox', { name: 'Buscar tareas' }), 'acme');
      expect(visibleTitles()).toEqual([expect.stringContaining('Preparar entrevista')]);

      await user.clear(screen.getByRole('searchbox', { name: 'Buscar tareas' }));
      await user.type(screen.getByRole('searchbox', { name: 'Buscar tareas' }), 'diseño');
      expect(visibleTitles()).toEqual([expect.stringContaining('Actualizar portfolio')]);
    });

    it('filtra por prioridad, estado y fecha', async () => {
      const user = userEvent.setup();
      renderFilterBoard();

      async function pick(filter: string, option: string) {
        await user.click(
          screen.getByRole('button', { name: new RegExp(`^Filtrar por ${filter}`) }),
        );
        await user.click(
          within(screen.getByRole('listbox', { name: `Filtrar por ${filter}` })).getByRole(
            'option',
            { name: option },
          ),
        );
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      }

      await pick('prioridad', 'Sin prioridad');
      expect(visibleTitles()).toEqual([expect.stringContaining('Leer documentación')]);
      await pick('prioridad', 'Todas');

      await pick('estado', 'Hecho');
      expect(visibleTitles()).toEqual([expect.stringContaining('Enviar solicitud')]);
      await pick('estado', 'Todos');

      await pick('fecha', 'Vencidas');
      expect(visibleTitles()).toEqual([expect.stringContaining('Actualizar portfolio')]);
      await pick('fecha', 'Para hoy');
      expect(visibleTitles()).toEqual([expect.stringContaining('Preparar entrevista')]);
      await pick('fecha', 'Próximos 7 días');
      expect(visibleTitles()).toHaveLength(2);
    });

    it('los desplegables se manejan con el teclado', async () => {
      const user = userEvent.setup();
      renderFilterBoard();

      const button = screen.getByRole('button', { name: 'Filtrar por prioridad: Todas' });
      button.focus();
      await user.keyboard('{ArrowDown}');
      const listbox = screen.getByRole('listbox', { name: 'Filtrar por prioridad' });
      expect(listbox).toHaveFocus();

      await user.keyboard('{ArrowDown}{Enter}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filtrar por prioridad: Alta' })).toHaveFocus();
      expect(visibleTitles()).toEqual([expect.stringContaining('Preparar entrevista')]);

      await user.keyboard('{Enter}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(visibleTitles()).toEqual([expect.stringContaining('Preparar entrevista')]);
    });

    it('sin resultados, permite quitar los filtros', async () => {
      const user = userEvent.setup();
      renderFilterBoard();

      await user.type(screen.getByRole('searchbox', { name: 'Buscar tareas' }), 'nada de esto');
      expect(screen.getByText('Ninguna tarea coincide')).toBeInTheDocument();

      await user.click(screen.getAllByRole('button', { name: 'Quitar filtros' })[0]!);
      expect(screen.getAllByRole('listitem')).toHaveLength(4);
    });
  });
});
