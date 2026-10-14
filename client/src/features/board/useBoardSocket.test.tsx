import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode, MutableRefObject } from 'react';
import { createTestQueryClient } from '../../test/test-utils';
import { fakeSocket } from '../../test/socketMock';
import { useBoardSocket, type ActiveDrag } from './useBoardSocket';
import { TAB_ID } from '../../socket/clientId';
import { boardsKeys } from '../boards/hooks';
import { useAuthStore } from '../../stores/authStore';
import type { BoardWithContent } from '../../types/api';

function makeBoard(): BoardWithContent {
  return {
    _id: 'board-1',
    title: 'Tablero',
    description: '',
    template: 'generic',
    owner: 'owner-1',
    members: [{ user: 'owner-1', role: 'admin' }],
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
        cards: [
          {
            _id: 'card-1',
            board: 'board-1',
            column: 'col-1',
            title: 'Original',
            position: 1000,
            labels: [],
            assignees: [],
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
      },
    ],
  };
}

function setup(board: BoardWithContent) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(boardsKeys.detail(board._id), board);
  const activeDragRef = { current: null } as MutableRefObject<ActiveDrag>;
  const onActiveCardRemoved = vi.fn();

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const { result } = renderHook(
    () => useBoardSocket(board._id, { activeDragRef, activeCardId: null, onActiveCardRemoved }),
    { wrapper: Wrapper },
  );

  return { queryClient, result, activeDragRef, onActiveCardRemoved };
}

describe('useBoardSocket', () => {
  it('aplica un card:updated remoto a la cache del tablero', async () => {
    const board = makeBoard();
    const { queryClient } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('card:updated', {
        card: { ...board.columns[0]!.cards[0]!, title: 'Editada por otro' },
        actorId: 'other-user',
        clientId: 'other-tab',
      });
    });

    const updated = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail('board-1'));
    expect(updated?.columns[0]?.cards[0]?.title).toBe('Editada por otro');
  });

  it('ignora el eco de la propia pestaña (mismo clientId)', async () => {
    const board = makeBoard();
    const { queryClient } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('card:updated', {
        card: { ...board.columns[0]!.cards[0]!, title: 'No debería aplicarse' },
        actorId: 'owner-1',
        clientId: TAB_ID,
      });
    });

    const updated = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail('board-1'));
    expect(updated?.columns[0]?.cards[0]?.title).toBe('Original');
  });

  it('no ignora el mismo actorId si viene de otra pestaña (clientId distinto)', async () => {
    const board = makeBoard();
    const { queryClient } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('card:updated', {
        card: { ...board.columns[0]!.cards[0]!, title: 'Desde mi otra pestaña' },
        actorId: 'owner-1',
        clientId: 'otra-pestana-mia',
      });
    });

    const updated = queryClient.getQueryData<BoardWithContent>(boardsKeys.detail('board-1'));
    expect(updated?.columns[0]?.cards[0]?.title).toBe('Desde mi otra pestaña');
  });

  it('cancela (dispara Escape) un arrastre en curso si un card:moved remoto afecta a lo que se arrastra', async () => {
    const board = makeBoard();
    const { activeDragRef } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));
    activeDragRef.current = { kind: 'card', id: 'card-1' };

    const escapeHandler = vi.fn();
    window.addEventListener('keydown', escapeHandler);

    act(() => {
      fakeSocket.trigger('card:moved', {
        card: { ...board.columns[0]!.cards[0]!, column: 'col-1' },
        actorId: 'other-user',
        clientId: 'other-tab',
      });
    });

    expect(escapeHandler).toHaveBeenCalledTimes(1);
    expect((escapeHandler.mock.calls[0]![0] as KeyboardEvent).key).toBe('Escape');

    window.removeEventListener('keydown', escapeHandler);
  });

  it('no interrumpe el arrastre si el evento remoto no afecta a lo que se arrastra', async () => {
    const board = makeBoard();
    const { activeDragRef } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));
    activeDragRef.current = { kind: 'card', id: 'otra-tarjeta' };

    const escapeHandler = vi.fn();
    window.addEventListener('keydown', escapeHandler);

    act(() => {
      fakeSocket.trigger('card:moved', {
        card: { ...board.columns[0]!.cards[0]!, column: 'col-1' },
        actorId: 'other-user',
        clientId: 'other-tab',
      });
    });

    expect(escapeHandler).not.toHaveBeenCalled();
    window.removeEventListener('keydown', escapeHandler);
  });

  it('expone accessLost cuando a mí me expulsan', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'owner-1', name: 'Owner', email: 'owner@example.com', createdAt: '2024-01-01' },
      accessToken: 'token',
    });
    const board = makeBoard();
    const { result } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('member:removed', { userId: 'owner-1', actorId: 'admin-2' });
    });

    await waitFor(() => expect(result.current.accessLost).toBe('removed'));
  });

  it('no expone accessLost si a otro miembro lo expulsan', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'owner-1', name: 'Owner', email: 'owner@example.com', createdAt: '2024-01-01' },
      accessToken: 'token',
    });
    const board = makeBoard();
    const { result } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('member:removed', { userId: 'otro-usuario', actorId: 'admin-2' });
    });

    expect(result.current.accessLost).toBeNull();
  });

  it('expone accessLost cuando el tablero se borra', async () => {
    const board = makeBoard();
    const { result } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('board:deleted', { boardId: 'board-1', actorId: 'admin-2' });
    });

    await waitFor(() => expect(result.current.accessLost).toBe('deleted'));
  });

  it('actualiza la presencia al recibir presence:update', async () => {
    const board = makeBoard();
    const { result } = setup(board);
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('presence:update', {
        users: [{ userId: 'owner-1', name: 'Owner', initials: 'O' }],
      });
    });

    await waitFor(() => expect(result.current.presence).toHaveLength(1));
  });
});
