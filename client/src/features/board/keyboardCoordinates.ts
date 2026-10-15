import type { KeyboardCoordinateGetter } from '@dnd-kit/core';

const ARROW_KEYS = new Set(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']);

// Las columnas ahora son filas de ancho completo: cada una tiene su propio
// SortableContext horizontal para las tarjetas, y el conjunto de filas uno
// vertical. El coordinate getter por defecto de @dnd-kit/sortable solo
// entiende listas 1D, así que no cruza de una fila a otra. Este calcula una
// coordenada virtual hacia el droppable más cercano en la dirección pedida:
// izquierda/derecha se queda en la misma fila (exige solape vertical con el
// origen); arriba/abajo salta a la fila vecina.
export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (!ARROW_KEYS.has(event.key)) {
    return undefined;
  }

  const { active, collisionRect, droppableRects } = context;
  if (!active || !collisionRect) {
    return undefined;
  }

  event.preventDefault();

  const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';

  const activeCenter = {
    x: collisionRect.left + collisionRect.width / 2,
    y: collisionRect.top + collisionRect.height / 2,
  };

  let closestId: string | undefined;
  let closestDistance = Infinity;

  for (const [id, rect] of droppableRects.entries()) {
    if (id === active.id) {
      continue;
    }

    // La columna que contiene a la tarjeta (su propio contenedor) nunca es un
    // destino: su centro suele quedar por debajo de la tarjeta y "↓" se
    // quedaría en la misma columna en vez de saltar a la siguiente.
    const containsActive =
      activeCenter.x >= rect.left &&
      activeCenter.x <= rect.left + rect.width &&
      activeCenter.y >= rect.top &&
      activeCenter.y <= rect.top + rect.height;
    if (containsActive) {
      continue;
    }

    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    if (horizontal) {
      // Mismo eje Y (misma fila): evita que ←/→ salte a otra fila.
      const sameRow = Math.abs(center.y - activeCenter.y) < collisionRect.height;
      const correctDirection = forward ? center.x > activeCenter.x : center.x < activeCenter.x;
      if (!sameRow || !correctDirection) {
        continue;
      }
    } else {
      // Otra fila de verdad: más de media tarjeta por encima/debajo. Con un
      // simple "más abajo", una tarjeta vecina de la MISMA fila desplazada
      // una fracción de píxel (transformaciones de dnd-kit) ganaba por cercanía.
      const halfHeight = collisionRect.height / 2;
      const correctDirection = forward
        ? center.y > activeCenter.y + halfHeight
        : center.y < activeCenter.y - halfHeight;
      if (!correctDirection) {
        continue;
      }
    }

    const distance = Math.hypot(center.x - activeCenter.x, center.y - activeCenter.y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestId = String(id);
    }
  }

  if (!closestId) {
    return undefined;
  }

  const targetRect = droppableRects.get(closestId);
  if (!targetRect) {
    return undefined;
  }

  return {
    x: targetRect.left + targetRect.width / 2 - collisionRect.width / 2,
    y: targetRect.top + targetRect.height / 2 - collisionRect.height / 2,
  };
};
