import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ColumnView } from '../columns/ColumnView';
import { SortableCard } from './SortableCard';
import type { ColumnWithCards, Card as CardType } from '../../types/api';
import type { ColumnDragData } from './dndTypes';

interface SortableColumnProps {
  boardId: string;
  column: ColumnWithCards;
  canEdit: boolean;
  onOpenCard: (card: CardType) => void;
}

// El nodo raíz (ver ColumnView) es a la vez el "item sortable" de la
// columna entre sus hermanas Y el droppable de respaldo para soltar una
// tarjeta en cualquier punto de la columna (incluida una vacía): su rect
// cubre toda la columna, no solo la cabecera.
export function SortableColumn({ boardId, column, canEdit, onOpenCard }: SortableColumnProps) {
  const data: ColumnDragData = { type: 'column' };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column._id,
    data,
    disabled: !canEdit,
  });

  const cardIds = column.cards.map((card) => card._id);

  return (
    <ColumnView
      ref={setNodeRef}
      boardId={boardId}
      column={column}
      canEdit={canEdit}
      isDragging={isDragging}
      dragHandleProps={canEdit ? { ...attributes, ...listeners } : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined }}
      cardsSlot={
        <SortableContext items={cardIds} strategy={horizontalListSortingStrategy}>
          {column.cards.map((card) => (
            <SortableCard
              key={card._id}
              card={card}
              columnId={column._id}
              disabled={!canEdit}
              onOpen={() => onOpenCard(card)}
            />
          ))}
        </SortableContext>
      }
    />
  );
}
