import type { BoardWithContent, Card, ColumnWithCards } from '../../types/api';

// Idéntico al de server/src/utils/calculatePosition.ts — mismo algoritmo,
// mismos tests. El servidor es quien persiste la posición real (recibe ids
// de vecinos, no un número); esta copia solo mantiene coherente el campo
// `position` de la tarjeta/columna optimista mientras dura la espera.
const GAP = 1000;

export function calculatePosition(prev?: number, next?: number): number {
  if (prev !== undefined && next !== undefined) {
    return (prev + next) / 2;
  }
  if (prev !== undefined) {
    return prev + GAP;
  }
  if (next !== undefined) {
    return next / 2;
  }
  return GAP;
}

interface WithId {
  _id: string;
}

// Vecinos para insertar ANTES del índice `index` en una lista ya sin el
// elemento que se mueve.
export function getNeighborIds<T extends WithId>(
  items: T[],
  index: number,
): { prevId?: string; nextId?: string } {
  return { prevId: items[index - 1]?._id, nextId: items[index]?._id };
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

export interface CardMoveParams {
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
  // Índice en columns[targetColumnId].cards (ya sin la tarjeta movida) donde
  // debe insertarse. sourceColumnId === targetColumnId cubre "dentro de la
  // misma columna"; distintos, "entre columnas" (incluida una vacía).
  targetIndex: number;
}

// Mueve una tarjeta dentro de la estructura del tablero, de forma inmutable.
// No requiere position: el orden lo da la posición en el array.
export function applyCardMove(board: BoardWithContent, params: CardMoveParams): BoardWithContent {
  const { cardId, sourceColumnId, targetColumnId, targetIndex } = params;

  const sourceColumn = board.columns.find((column) => column._id === sourceColumnId);
  const card = sourceColumn?.cards.find((c) => c._id === cardId);
  if (!sourceColumn || !card) {
    return board;
  }

  const withoutCard = board.columns.map((column) =>
    column._id === sourceColumnId
      ? { ...column, cards: column.cards.filter((c) => c._id !== cardId) }
      : column,
  );

  const targetColumn = withoutCard.find((column) => column._id === targetColumnId);
  if (!targetColumn) {
    return board;
  }

  const index = clampIndex(targetIndex, targetColumn.cards.length);
  const prevPosition = targetColumn.cards[index - 1]?.position;
  const nextPosition = targetColumn.cards[index]?.position;
  const movedCard: Card = {
    ...card,
    column: targetColumnId,
    position: calculatePosition(prevPosition, nextPosition),
  };

  return {
    ...board,
    columns: withoutCard.map((column) =>
      column._id === targetColumnId
        ? {
            ...column,
            cards: [...column.cards.slice(0, index), movedCard, ...column.cards.slice(index)],
          }
        : column,
    ),
  };
}

export interface ColumnMoveParams {
  columnId: string;
  // Índice en board.columns (ya sin la columna movida) donde debe insertarse.
  targetIndex: number;
}

export function applyColumnMove(
  board: BoardWithContent,
  params: ColumnMoveParams,
): BoardWithContent {
  const fromIndex = board.columns.findIndex((column) => column._id === params.columnId);
  if (fromIndex === -1) {
    return board;
  }

  const columns = [...board.columns];
  const [moved] = columns.splice(fromIndex, 1);
  if (!moved) {
    return board;
  }

  const index = clampIndex(params.targetIndex, columns.length);
  const prevPosition = columns[index - 1]?.position;
  const nextPosition = columns[index]?.position;
  const movedColumn: ColumnWithCards = {
    ...moved,
    position: calculatePosition(prevPosition, nextPosition),
  };

  columns.splice(index, 0, movedColumn);
  return { ...board, columns };
}

export interface CardMoveApiInput {
  columnId: string;
  prevCardId?: string;
  nextCardId?: string;
}

// A partir del tablero ANTES de aplicar el movimiento, deriva lo que hay que
// mandarle a PATCH /api/cards/:id/move (vecinos, no una posición).
export function cardMoveApiInput(
  board: BoardWithContent,
  params: CardMoveParams,
): CardMoveApiInput {
  const targetColumn = board.columns.find((column) => column._id === params.targetColumnId);
  const siblings = (targetColumn?.cards ?? []).filter((c) => c._id !== params.cardId);
  const index = clampIndex(params.targetIndex, siblings.length);
  const { prevId, nextId } = getNeighborIds(siblings, index);
  return { columnId: params.targetColumnId, prevCardId: prevId, nextCardId: nextId };
}

export interface ColumnMoveApiInput {
  prevColumnId?: string;
  nextColumnId?: string;
}

export function columnMoveApiInput(
  board: Pick<BoardWithContent, 'columns'>,
  params: ColumnMoveParams,
): ColumnMoveApiInput {
  const siblings = board.columns.filter((column) => column._id !== params.columnId);
  const index = clampIndex(params.targetIndex, siblings.length);
  const { prevId, nextId } = getNeighborIds(siblings, index);
  return { prevColumnId: prevId, nextColumnId: nextId };
}
