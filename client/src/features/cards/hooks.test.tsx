import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { createTestQueryClient } from '../../test/test-utils';
import { deferred } from '../../test/deferred';
import { useMoveCardMutation } from './hooks';
import { boardsKeys } from '../boards/hooks';
import type { BoardWithContent, Card } from '../../types/api';

function makeCard(id: string, columnId: string, position: number): Card {
  return {
    _id: id,
    board: 'board-1',
    column: columnId,
    title: id,
    position,
    labels: [],
    assignees: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

function makeBoard(): BoardWithContent {
  return {
    _id: 'board-1',
    title: 'Tablero',
    template: 'generic',
    owner: 'user-1',
    members: [{ user: 'user-1', role: 'editor' }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    columns: [
      {
        _id: 'col-1',
        board: 'board-1',
        title: 'Por hacer',
        position: 1000,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cards: [makeCard('a', 'col-1', 1000)],
      },
      {
        _id: 'col-2',
        board: 'board-1',
        title: 'En curso',
        position: 2000,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cards: [],
      },
    ],
  };
}

function wrapperFor(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useMoveCardMutation — optimismo', () => {
  it('éxito: la cache cambia al instante y se mantiene tras la respuesta', async () => {
    const queryClient = createTestQueryClient();
    const board = makeBoard();
    queryClient.setQueryData(boardsKeys.detail(board._id), board);

    const response = deferred();
    server.use(
      http.patch('/api/cards/:id/move', async ({ params }) => {
        await response.promise;
        return HttpResponse.json({ card: { ...makeCard(String(params.id), 'col-2', 1000) } });
      }),
    );

    const { result } = renderHook(() => useMoveCardMutation(board._id), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => {
      result.current.mutate({
        cardId: 'a',
        apiInput: { columnId: 'col-2' },
        cardMove: { cardId: 'a', sourceColumnId: 'col-1', targetColumnId: 'col-2', targetIndex: 0 },
      });
    });

    // Con la respuesta del servidor aún retenida, onMutate ya aplicó el
    // cambio a la cache: eso es lo que demuestra el optimismo.
    await waitFor(() => {
      const data = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail(board._id));
      expect(data?.columns[1]?.cards.map((card) => card._id)).toEqual(['a']);
      expect(data?.columns[0]?.cards).toEqual([]);
    });
    expect(result.current.isPending).toBe(true);

    response.resolve();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Tras la respuesta del servidor, se mantiene (no vuelve a parpadear).
    const final = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail(board._id));
    expect(final?.columns[1]?.cards.map((card) => card._id)).toEqual(['a']);
  });

  it('error del servidor: deshace el cambio y no deja la cache a medias', async () => {
    const queryClient = createTestQueryClient();
    const board = makeBoard();
    queryClient.setQueryData(boardsKeys.detail(board._id), board);

    server.use(
      http.patch('/api/cards/:id/move', () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'fallo' } }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useMoveCardMutation(board._id), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => {
      result.current.mutate({
        cardId: 'a',
        apiInput: { columnId: 'col-2' },
        cardMove: { cardId: 'a', sourceColumnId: 'col-1', targetColumnId: 'col-2', targetIndex: 0 },
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const final = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail(board._id));
    expect(final).toEqual(board);
  });

  it('dos movimientos seguidos sobre el mismo tablero se envían en orden', async () => {
    const queryClient = createTestQueryClient();
    const board = makeBoard();
    queryClient.setQueryData(boardsKeys.detail(board._id), board);

    const callOrder: string[] = [];
    const firstResponse = deferred();
    server.use(
      http.patch('/api/cards/:id/move', async ({ params }) => {
        callOrder.push(String(params.id));
        if (params.id === 'a') {
          await firstResponse.promise;
        }
        return HttpResponse.json({ card: makeCard(String(params.id), 'col-2', 1000) });
      }),
    );

    const { result: first } = renderHook(() => useMoveCardMutation(board._id), {
      wrapper: wrapperFor(queryClient),
    });
    const { result: second } = renderHook(() => useMoveCardMutation(board._id), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => {
      first.current.mutate({
        cardId: 'a',
        apiInput: { columnId: 'col-2' },
        cardMove: { cardId: 'a', sourceColumnId: 'col-1', targetColumnId: 'col-2', targetIndex: 0 },
      });
      second.current.mutate({
        cardId: 'b',
        apiInput: { columnId: 'col-2' },
        cardMove: { cardId: 'b', sourceColumnId: 'col-1', targetColumnId: 'col-2', targetIndex: 1 },
      });
    });

    // Mientras la primera sigue en vuelo, la segunda queda en pausa en la
    // cola del scope y no llega al servidor.
    await waitFor(() => expect(callOrder).toEqual(['a']));
    expect(second.current.isPaused).toBe(true);

    firstResponse.resolve();
    await waitFor(() => expect(first.current.isSuccess).toBe(true));
    await waitFor(() => expect(second.current.isSuccess).toBe(true));

    // El mismo "scope" (board-<id>) las encola: nunca llegan en paralelo.
    expect(callOrder).toEqual(['a', 'b']);
  });
});
