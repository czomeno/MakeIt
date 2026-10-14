import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type Collision,
} from '@dnd-kit/core';
import { isCardData } from './dndTypes';

function isOverCard(collision: Collision): boolean {
  const container = (
    collision.data as { droppableContainer?: { data?: { current?: unknown } } } | undefined
  )?.droppableContainer;
  return isCardData(container?.data?.current);
}

// closestCorners compara distancias geométricas contra TODOS los droppables;
// con columnas de alturas muy distintas puede enganchar a la columna
// geométricamente más cercana aunque el puntero esté claramente dentro de
// otra. Esta estrategia ancla la colisión a donde está realmente el puntero:
// 1) si hay alguna tarjeta bajo el puntero, se prioriza (inserción precisa)
// 2) si no, cualquier droppable bajo el puntero (columna vacía, huecos)
// 3) si el puntero se "sale" un instante (arrastre rápido), rectIntersection
//    como red de seguridad para no perder el drag.
export const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  const cardCollisions = pointerCollisions.filter(isOverCard);
  if (cardCollisions.length > 0) {
    return cardCollisions;
  }

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  return rectIntersection(args);
};
