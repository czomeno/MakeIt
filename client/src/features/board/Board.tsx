import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Active,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableColumn } from './SortableColumn';
import { CardOverlay } from './CardOverlay';
import { ColumnOverlay } from './ColumnOverlay';
import { CreateColumnForm } from '../columns/CreateColumnForm';
import { collisionDetectionStrategy } from './collisionDetection';
import { createAnnouncements } from './announcements';
import { boardKeyboardCoordinates } from './keyboardCoordinates';
import {
  applyCardMove,
  applyColumnMove,
  cardMoveApiInput,
  columnMoveApiInput,
} from './boardReducers';
import { isCardData, isColumnData } from './dndTypes';
import { useMoveCardMutation } from '../cards/hooks';
import { useMoveColumnMutation } from '../columns/hooks';
import type { ActiveDrag } from './useBoardSocket';
import type { BoardWithContent, Card as CardType } from '../../types/api';

interface BoardProps {
  board: BoardWithContent;
  canEdit: boolean;
  onOpenCard: (card: CardType) => void;
  // Espejo (sin provocar renders) de qué se está arrastrando ahora mismo,
  // para que useBoardSocket pueda cancelar el arrastre si un evento remoto
  // mueve o borra justo lo que este cliente tiene en la mano.
  activeDragRef?: MutableRefObject<ActiveDrag>;
}

type ResolvedDrop =
  | { kind: 'card'; params: Parameters<typeof applyCardMove>[1] }
  | { kind: 'column'; params: Parameters<typeof applyColumnMove>[1] };

function resolveDrop(board: BoardWithContent, active: Active, over: Over): ResolvedDrop | null {
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

function findCard(board: BoardWithContent, id: string): CardType | undefined {
  for (const column of board.columns) {
    const card = column.cards.find((c) => c._id === id);
    if (card) {
      return card;
    }
  }
  return undefined;
}

export function Board({ board, canEdit, onOpenCard, activeDragRef }: BoardProps) {
  const boardId = board._id;
  const [dragPreview, setDragPreview] = useState<BoardWithContent | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<'card' | 'column' | null>(null);
  // Cuenta los movimientos aún sin asentar; dragPreview solo se limpia
  // cuando llega a 0, para que arrastres seguidos nunca muestren el orden
  // antiguo mientras una mutación anterior sigue encolada (scope).
  const pendingMoves = useRef(0);

  const moveCardMutation = useMoveCardMutation(boardId);
  const moveColumnMutation = useMoveColumnMutation(boardId);

  const liveBoard = dragPreview ?? board;
  const announcements = useMemo(() => createAnnouncements(liveBoard), [liveBoard]);
  const columnIds = useMemo(() => liveBoard.columns.map((column) => column._id), [liveBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates }),
  );

  function settleDrag() {
    pendingMoves.current = Math.max(0, pendingMoves.current - 1);
    if (pendingMoves.current === 0) {
      setDragPreview(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    const id = String(event.active.id);
    const kind = isCardData(data) ? 'card' : isColumnData(data) ? 'column' : null;
    setActiveId(id);
    setActiveKind(kind);
    if (activeDragRef) {
      activeDragRef.current = kind ? { kind, id } : null;
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const resolved = resolveDrop(liveBoard, active, over);
    if (!resolved) {
      return;
    }
    const next =
      resolved.kind === 'card'
        ? applyCardMove(liveBoard, resolved.params)
        : applyColumnMove(liveBoard, resolved.params);
    if (next !== liveBoard) {
      setDragPreview(next);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setActiveKind(null);
    if (activeDragRef) {
      activeDragRef.current = null;
    }

    const resolved = over ? resolveDrop(liveBoard, active, over) : null;
    if (!resolved) {
      if (pendingMoves.current === 0) {
        setDragPreview(null);
      }
      return;
    }

    if (resolved.kind === 'card') {
      const finalBoard = applyCardMove(liveBoard, resolved.params);
      const apiInput = cardMoveApiInput(liveBoard, resolved.params);
      setDragPreview(finalBoard);
      pendingMoves.current += 1;
      moveCardMutation.mutate(
        { cardId: resolved.params.cardId, apiInput, cardMove: resolved.params },
        { onSettled: settleDrag },
      );
    } else {
      const finalBoard = applyColumnMove(liveBoard, resolved.params);
      const apiInput = columnMoveApiInput(liveBoard, resolved.params);
      setDragPreview(finalBoard);
      pendingMoves.current += 1;
      moveColumnMutation.mutate(
        { columnId: resolved.params.columnId, apiInput, columnMove: resolved.params },
        { onSettled: settleDrag },
      );
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveId(null);
    setActiveKind(null);
    if (activeDragRef) {
      activeDragRef.current = null;
    }
    if (pendingMoves.current === 0) {
      setDragPreview(null);
    }
  }

  const activeCard = activeKind === 'card' && activeId ? findCard(liveBoard, activeId) : undefined;
  const activeColumn =
    activeKind === 'column' && activeId
      ? liveBoard.columns.find((column) => column._id === activeId)
      : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-4">
          {liveBoard.columns.map((column) => (
            <SortableColumn
              key={column._id}
              boardId={boardId}
              column={column}
              canEdit={canEdit}
              onOpenCard={onOpenCard}
            />
          ))}
          {canEdit && <CreateColumnForm boardId={boardId} />}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeCard && <CardOverlay card={activeCard} />}
        {activeColumn && <ColumnOverlay column={activeColumn} />}
      </DragOverlay>
    </DndContext>
  );
}
