import type { ActivityItem, BoardWithContent, Card } from '../types/api';

export function makeCard(id: string, columnId: string, overrides: Partial<Card> = {}): Card {
  return {
    _id: id,
    board: 'board-1',
    column: columnId,
    title: id,
    position: 1000,
    labels: [],
    assignees: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Tablero con dos columnas: "Por hacer" (con las tarjetas dadas) y "Hecho".
export function makeBoard(cards: Card[] = [], overrides: Partial<BoardWithContent> = {}) {
  const board: BoardWithContent = {
    _id: 'board-1',
    title: 'Tablero',
    template: 'generic',
    owner: 'user-1',
    members: [{ user: 'user-1', role: 'admin' }],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    columns: [
      {
        _id: 'col-1',
        board: 'board-1',
        title: 'Por hacer',
        position: 1000,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        cards,
      },
      {
        _id: 'col-2',
        board: 'board-1',
        title: 'Hecho',
        position: 2000,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        cards: [],
      },
    ],
    ...overrides,
  };
  return board;
}

export function makeActivity(id: string, overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    _id: id,
    board: 'board-1',
    actor: { _id: 'user-1', name: 'Ada', email: 'ada@example.com' },
    type: 'card.created',
    data: { cardTitle: `Tarjeta ${id}`, columnTitle: 'Por hacer' },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
