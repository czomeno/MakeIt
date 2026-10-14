import { describe, it, expect } from 'vitest';
import {
  calculatePosition,
  getNeighborIds,
  applyCardMove,
  applyColumnMove,
  cardMoveApiInput,
  columnMoveApiInput,
} from './boardReducers';
import type { BoardWithContent, Card, ColumnWithCards } from '../../types/api';

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

function makeColumn(id: string, position: number, cards: Card[]): ColumnWithCards {
  return {
    _id: id,
    board: 'board-1',
    title: id,
    position,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    cards,
  };
}

function makeBoard(columns: ColumnWithCards[]): BoardWithContent {
  return {
    _id: 'board-1',
    title: 'Tablero',
    template: 'generic',
    owner: 'user-1',
    members: [{ user: 'user-1', role: 'editor' }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    columns,
  };
}

describe('calculatePosition', () => {
  // Mismos casos que server/tests/calculatePosition.test.ts — mismo algoritmo.
  it('devuelve una posición inicial cuando la lista está vacía', () => {
    expect(calculatePosition(undefined, undefined)).toBe(1000);
  });

  it('se aleja hacia delante cuando solo hay un vecino anterior', () => {
    expect(calculatePosition(1000, undefined)).toBe(2000);
  });

  it('se acerca al origen cuando solo hay un vecino siguiente', () => {
    expect(calculatePosition(undefined, 1000)).toBe(500);
  });

  it('calcula el punto medio entre dos vecinos', () => {
    expect(calculatePosition(1000, 2000)).toBe(1500);
  });

  it('el resultado queda siempre estrictamente entre los vecinos', () => {
    const casos: Array<[number, number]> = [
      [1000, 1001],
      [0, 1],
      [-500, 500],
    ];
    for (const [prev, next] of casos) {
      const position = calculatePosition(prev, next);
      expect(position).toBeGreaterThan(prev);
      expect(position).toBeLessThan(next);
    }
  });
});

describe('getNeighborIds', () => {
  it('devuelve los ids antes y después del índice dado', () => {
    const items = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
    expect(getNeighborIds(items, 1)).toEqual({ prevId: 'a', nextId: 'b' });
    expect(getNeighborIds(items, 0)).toEqual({ prevId: undefined, nextId: 'a' });
    expect(getNeighborIds(items, 3)).toEqual({ prevId: 'c', nextId: undefined });
  });
});

describe('applyCardMove', () => {
  it('mueve una tarjeta al principio de la misma columna', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, [
        makeCard('a', 'col-1', 1000),
        makeCard('b', 'col-1', 2000),
        makeCard('c', 'col-1', 3000),
      ]),
    ]);

    const result = applyCardMove(board, {
      cardId: 'c',
      sourceColumnId: 'col-1',
      targetColumnId: 'col-1',
      targetIndex: 0,
    });

    expect(result.columns[0]?.cards.map((c) => c._id)).toEqual(['c', 'a', 'b']);
  });

  it('mueve una tarjeta al medio de la misma columna', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, [
        makeCard('a', 'col-1', 1000),
        makeCard('b', 'col-1', 2000),
        makeCard('c', 'col-1', 3000),
      ]),
    ]);

    const result = applyCardMove(board, {
      cardId: 'a',
      sourceColumnId: 'col-1',
      targetColumnId: 'col-1',
      targetIndex: 1,
    });

    expect(result.columns[0]?.cards.map((c) => c._id)).toEqual(['b', 'a', 'c']);
  });

  it('mueve una tarjeta al final de la misma columna', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, [
        makeCard('a', 'col-1', 1000),
        makeCard('b', 'col-1', 2000),
        makeCard('c', 'col-1', 3000),
      ]),
    ]);

    const result = applyCardMove(board, {
      cardId: 'a',
      sourceColumnId: 'col-1',
      targetColumnId: 'col-1',
      targetIndex: 2,
    });

    expect(result.columns[0]?.cards.map((c) => c._id)).toEqual(['b', 'c', 'a']);
  });

  it('mueve una tarjeta a otra columna, en la posición indicada', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, [makeCard('a', 'col-1', 1000), makeCard('b', 'col-1', 2000)]),
      makeColumn('col-2', 2000, [makeCard('x', 'col-2', 1000), makeCard('y', 'col-2', 2000)]),
    ]);

    const result = applyCardMove(board, {
      cardId: 'a',
      sourceColumnId: 'col-1',
      targetColumnId: 'col-2',
      targetIndex: 1,
    });

    expect(result.columns[0]?.cards.map((c) => c._id)).toEqual(['b']);
    expect(result.columns[1]?.cards.map((c) => c._id)).toEqual(['x', 'a', 'y']);
    expect(result.columns[1]?.cards.find((c) => c._id === 'a')?.column).toBe('col-2');
  });

  it('mueve una tarjeta a una columna vacía', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, [makeCard('a', 'col-1', 1000)]),
      makeColumn('col-2', 2000, []),
    ]);

    const result = applyCardMove(board, {
      cardId: 'a',
      sourceColumnId: 'col-1',
      targetColumnId: 'col-2',
      targetIndex: 0,
    });

    expect(result.columns[0]?.cards).toEqual([]);
    expect(result.columns[1]?.cards.map((c) => c._id)).toEqual(['a']);
  });

  it('la posición resultante queda entre los dos vecinos del destino', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, [makeCard('a', 'col-1', 1000), makeCard('b', 'col-1', 2000)]),
    ]);

    const result = applyCardMove(board, {
      cardId: 'a',
      sourceColumnId: 'col-1',
      targetColumnId: 'col-1',
      targetIndex: 1,
    });
    const moved = result.columns[0]?.cards.find((c) => c._id === 'a');

    // Tras quitar "a", solo queda "b" (position 2000) antes del destino y
    // ningún vecino siguiente -> calculatePosition(2000, undefined) = 3000.
    expect(moved?.position).toBe(3000);
  });

  it('no cambia nada si la tarjeta o la columna de origen no existen', () => {
    const board = makeBoard([makeColumn('col-1', 1000, [makeCard('a', 'col-1', 1000)])]);
    const result = applyCardMove(board, {
      cardId: 'no-existe',
      sourceColumnId: 'col-1',
      targetColumnId: 'col-1',
      targetIndex: 0,
    });
    expect(result).toBe(board);
  });
});

describe('applyColumnMove', () => {
  it('reordena las columnas del tablero', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, []),
      makeColumn('col-2', 2000, []),
      makeColumn('col-3', 3000, []),
    ]);

    const result = applyColumnMove(board, { columnId: 'col-3', targetIndex: 0 });

    expect(result.columns.map((c) => c._id)).toEqual(['col-3', 'col-1', 'col-2']);
  });

  it('no cambia nada si la columna no existe', () => {
    const board = makeBoard([makeColumn('col-1', 1000, [])]);
    const result = applyColumnMove(board, { columnId: 'no-existe', targetIndex: 0 });
    expect(result).toBe(board);
  });
});

describe('cardMoveApiInput', () => {
  it('deriva los vecinos a partir del índice destino', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, [makeCard('a', 'col-1', 1000)]),
      makeColumn('col-2', 2000, [makeCard('x', 'col-2', 1000), makeCard('y', 'col-2', 2000)]),
    ]);

    const input = cardMoveApiInput(board, {
      cardId: 'a',
      sourceColumnId: 'col-1',
      targetColumnId: 'col-2',
      targetIndex: 1,
    });

    expect(input).toEqual({ columnId: 'col-2', prevCardId: 'x', nextCardId: 'y' });
  });
});

describe('columnMoveApiInput', () => {
  it('deriva los vecinos a partir del índice destino', () => {
    const board = makeBoard([
      makeColumn('col-1', 1000, []),
      makeColumn('col-2', 2000, []),
      makeColumn('col-3', 3000, []),
    ]);

    const input = columnMoveApiInput(board, { columnId: 'col-3', targetIndex: 1 });

    expect(input).toEqual({ prevColumnId: 'col-1', nextColumnId: 'col-2' });
  });
});
