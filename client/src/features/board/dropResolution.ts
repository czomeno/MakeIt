import type { Active, Over } from '@dnd-kit/core';
import type { applyCardMove, applyColumnMove } from './boardReducers';
import { isCardData, isColumnData } from './dndTypes';
import type { BoardWithContent } from '../../types/api';

// Traduce los eventos de dnd-kit (active/over) a un movimiento del tablero.
// Separado de Board.tsx para poder probarlo sin montar el DndContext.

export type ResolvedDrop =
  | { kind: 'card'; params: Parameters<typeof applyCardMove>[1] }
  | { kind: 'column'; params: Parameters<typeof applyColumnMove>[1] };

export function resolveDrop(
  board: BoardWithContent,
  active: Active,
  over: Over,
): ResolvedDrop | null {
  const activeData = active.data.current;
  const overData = over.data.current;

  if (isCardData(activeData)) {
    const cardId = String(active.id);
    const sourceColumnId = activeData.columnId;

    if (isCardData(overData)) {
      const targetColumnId = overData.columnId;
      const targetColumn = board.columns.find((column) => column._id === targetColumnId);
      const targetIndex = targetColumn?.cards.findIndex((card) => card._id === over.id) ?? -1;
      if (!targetColumn || targetIndex === -1) {
        return null;
      }
      return { kind: 'card', params: { cardId, sourceColumnId, targetColumnId, targetIndex } };
    }

    if (isColumnData(overData)) {
      const targetColumnId = String(over.id);
      const targetColumn = board.columns.find((column) => column._id === targetColumnId);
      if (!targetColumn) {
        return null;
      }
      // Soltado en la columna (no sobre una tarjeta concreta): al final.
      return {
        kind: 'card',
        params: { cardId, sourceColumnId, targetColumnId, targetIndex: targetColumn.cards.length },
      };
    }

    return null;
  }

  if (isColumnData(activeData)) {
    const targetIndex = board.columns.findIndex((column) => column._id === over.id);
    if (targetIndex === -1) {
      return null;
    }
    return { kind: 'column', params: { columnId: String(active.id), targetIndex } };
  }

  return null;
}

// Dónde está ahora mismo lo que se arrastra en `board` (la vista previa), como
// un "movimiento" a su propia posición: aplicarlo no cambia nada y sirve para
// derivar los vecinos que hay que mandar a la API.
function resolveCurrentPlacement(board: BoardWithContent, active: Active): ResolvedDrop | null {
  const id = String(active.id);
  if (isCardData(active.data.current)) {
    for (const column of board.columns) {
      const targetIndex = column.cards.findIndex((card) => card._id === id);
      if (targetIndex !== -1) {
        const columnId = column._id;
        return {
          kind: 'card',
          params: { cardId: id, sourceColumnId: columnId, targetColumnId: columnId, targetIndex },
        };
      }
    }
    return null;
  }
  if (isColumnData(active.data.current)) {
    const targetIndex = board.columns.findIndex((column) => column._id === id);
    return targetIndex === -1 ? null : { kind: 'column', params: { columnId: id, targetIndex } };
  }
  return null;
}

// Al soltar: si el destino es el mismo que ya aplicó onDragOver a la vista
// previa, esa vista previa YA es la posición final. Volver a resolverlo contra
// ella aplicaría el movimiento dos veces (con el teclado, deshaciéndolo: la
// tarjeta volvía a su sitio). Con el ratón no se notaba porque al soltar el
// puntero suele estar ya sobre el hueco de la propia tarjeta.
export function resolveFinalDrop(
  liveBoard: BoardWithContent,
  active: Active,
  over: Over | null,
  lastAppliedOverId: string | null,
): ResolvedDrop | null {
  if (!over) {
    return null;
  }
  if (String(over.id) === lastAppliedOverId) {
    return resolveCurrentPlacement(liveBoard, active);
  }
  return resolveDrop(liveBoard, active, over);
}
