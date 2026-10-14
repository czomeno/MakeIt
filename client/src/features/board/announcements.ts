import type { Announcements, UniqueIdentifier } from '@dnd-kit/core';
import type { BoardWithContent, ColumnWithCards } from '../../types/api';

function findColumn(board: BoardWithContent, id: UniqueIdentifier): ColumnWithCards | undefined {
  return board.columns.find((column) => column._id === id);
}

function findCardColumn(
  board: BoardWithContent,
  id: UniqueIdentifier,
): ColumnWithCards | undefined {
  return board.columns.find((column) => column.cards.some((card) => card._id === id));
}

function cardTitle(board: BoardWithContent, id: UniqueIdentifier): string | undefined {
  for (const column of board.columns) {
    const card = column.cards.find((c) => c._id === id);
    if (card) {
      return card.title;
    }
  }
  return undefined;
}

// Se reconstruye en cada render con los datos vigentes (ver Board.tsx), así
// que siempre anuncia sobre el estado que se ve en pantalla.
export function createAnnouncements(board: BoardWithContent): Announcements {
  return {
    onDragStart({ active }) {
      const title = cardTitle(board, active.id);
      if (title) {
        const column = findCardColumn(board, active.id);
        return `Tarjeta ${title} recogida${column ? ` de la columna ${column.title}` : ''}.`;
      }
      const column = findColumn(board, active.id);
      if (column) {
        return `Columna ${column.title} recogida.`;
      }
      return undefined;
    },
    onDragOver({ active, over }) {
      if (!over) {
        return undefined;
      }
      const title = cardTitle(board, active.id);
      if (title) {
        const overColumn = findColumn(board, over.id) ?? findCardColumn(board, over.id);
        return overColumn ? `Tarjeta ${title} sobre la columna ${overColumn.title}.` : undefined;
      }
      const activeColumn = findColumn(board, active.id);
      if (activeColumn) {
        const index = board.columns.findIndex((column) => column._id === over.id);
        return index === -1
          ? undefined
          : `Columna ${activeColumn.title} sobre la posición ${index + 1}.`;
      }
      return undefined;
    },
    onDragEnd({ active, over }) {
      const title = cardTitle(board, active.id);
      if (title) {
        if (!over) {
          return `Movimiento de la tarjeta ${title} cancelado.`;
        }
        const overColumn = findColumn(board, over.id) ?? findCardColumn(board, over.id);
        return overColumn
          ? `Tarjeta ${title} soltada en la columna ${overColumn.title}.`
          : `Tarjeta ${title} soltada.`;
      }
      const activeColumn = findColumn(board, active.id);
      if (activeColumn) {
        return over
          ? `Columna ${activeColumn.title} soltada.`
          : `Movimiento de la columna ${activeColumn.title} cancelado.`;
      }
      return undefined;
    },
    onDragCancel({ active }) {
      const title = cardTitle(board, active.id);
      if (title) {
        return `Movimiento de la tarjeta ${title} cancelado.`;
      }
      const column = findColumn(board, active.id);
      return column ? `Movimiento de la columna ${column.title} cancelado.` : undefined;
    },
  };
}
