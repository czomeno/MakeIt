import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CardItem } from '../cards/CardItem';
import type { Card } from '../../types/api';
import type { CardDragData } from './dndTypes';

interface SortableCardProps {
  card: Card;
  columnId: string;
  disabled: boolean;
  onOpen: () => void;
}

export function SortableCard({ card, columnId, disabled, onOpen }: SortableCardProps) {
  const data: CardDragData = { type: 'card', columnId };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card._id,
    data,
    disabled,
  });

  return (
    <CardItem
      ref={setNodeRef}
      card={card}
      onOpen={onOpen}
      isDragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined }}
      className={disabled ? undefined : 'cursor-grab active:cursor-grabbing'}
      {...attributes}
      {...listeners}
    />
  );
}
