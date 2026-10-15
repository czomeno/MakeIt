import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { createTestQueryClient } from '../../test/test-utils';
import { deferred } from '../../test/deferred';
import { makeBoard } from '../../test/fixtures';
import { boardsKeys } from '../boards/hooks';
import { useToastStore } from '../../stores/toastStore';
import { useMoveColumnMutation } from './hooks';
import type { BoardWithContent } from '../../types/api';

function setup() {
  const queryClient = createTestQueryClient();
  const board = makeBoard();
  queryClient.setQueryData(boardsKeys.detail(board._id), board);
  server.use(http.get('/api/boards/:id', () => HttpResponse.json({ board })));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useMoveColumnMutation(board._id), { wrapper });
  const columnOrder = () =>
    queryClient
      .getQueryData<BoardWithContent>(boardsKeys.detail(board._id))
      ?.columns.map((column) => column._id);
  const moveSecondToFront = () =>
    act(() => {
      result.current.mutate({
        columnId: 'col-2',
        apiInput: { nextColumnId: 'col-1' },
        columnMove: { columnId: 'col-2', targetIndex: 0 },
      });
    });
  return { board, result, columnOrder, moveSecondToFront };
}

describe('useMoveColumnMutation — optimismo', () => {
  it('reordena la cache antes de que responda el servidor', async () => {
    const response = deferred();
    server.use(
      http.patch('/api/columns/:id/move', async () => {
        await response.promise;
        return HttpResponse.json({ column: {} });
      }),
    );
    const { result, columnOrder, moveSecondToFront } = setup();

    moveSecondToFront();
    await waitFor(() => expect(columnOrder()).toEqual(['col-2', 'col-1']));
    expect(result.current.isPending).toBe(true);

    response.resolve();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('si el servidor falla, deshace el cambio y avisa', async () => {
    server.use(
      http.patch('/api/columns/:id/move', () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 }),
      ),
    );
    const { board, result, columnOrder, moveSecondToFront } = setup();

    moveSecondToFront();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(columnOrder()).toEqual(board.columns.map((column) => column._id));
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
      'No se pudo mover la columna. Se ha deshecho el cambio.',
    );
  });
});
