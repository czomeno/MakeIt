import type { BoardWithContent, Card, ColumnWithCards } from '../../types/api';

// A diferencia de boardReducers.ts (que mueve tarjetas/columnas por ÍNDICE,
// pensado para el arrastre local), estas funciones aplican el estado
// ABSOLUTO que llega por socket (un `card`/`column` ya con su `position`
// final) a la cache. Sirven igual para created/updated/moved: los tres
// eventos traen el documento completo.

export function upsertCard(board: BoardWithContent, card: Card): BoardWithContent {
  const targetColumn = board.columns.find((column) => column._id === card.column);
  if (!targetColumn) {
    // La tarjeta pertenece a una columna que esta cache no conoce (p. ej.
    // un desajuste tras una reconexión): quien llama debe invalidar en vez
    // de intentar un parcheo quirúrgico a ciegas.
    return board;
  }

  const withoutCard: ColumnWithCards[] = board.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((c) => c._id !== card._id),
  }));

  return {
    ...board,
    columns: withoutCard.map((column) =>
      column._id === card.column
        ? { ...column, cards: [...column.cards, card].sort((a, b) => a.position - b.position) }
        : column,
    ),
  };
}

export function removeCard(board: BoardWithContent, cardId: string): BoardWithContent {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((c) => c._id !== cardId),
    })),
  };
}

export function upsertColumn(
  board: BoardWithContent,
  column: Omit<ColumnWithCards, 'cards'>,
): BoardWithContent {
  const exists = board.columns.some((c) => c._id === column._id);
  const merged = exists
    ? board.columns.map((c) => (c._id === column._id ? { ...c, ...column } : c))
    : [...board.columns, { ...column, cards: [] }];

  return { ...board, columns: [...merged].sort((a, b) => a.position - b.position) };
}

export function removeColumn(board: BoardWithContent, columnId: string): BoardWithContent {
  return { ...board, columns: board.columns.filter((c) => c._id !== columnId) };
}
