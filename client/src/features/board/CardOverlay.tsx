import { CardItem } from '../cards/CardItem';
import type { Card } from '../../types/api';

interface CardOverlayProps {
  card: Card;
}

// Copia visual de la tarjeta mientras se arrastra (DragOverlay de dnd-kit).
// No es interactiva: no necesita onOpen real.
export function CardOverlay({ card }: CardOverlayProps) {
  return (
    <div className="rotate-2 cursor-grabbing">
      <CardItem card={card} onOpen={() => undefined} isOverlay />
    </div>
  );
}
