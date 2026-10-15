import { describe, it, expect } from 'vitest';
import type { KeyboardCoordinateGetter } from '@dnd-kit/core';
import { boardKeyboardCoordinates } from './keyboardCoordinates';

type Args = Parameters<KeyboardCoordinateGetter>[1];

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

// Dos filas-columna apiladas, de 1000×200. La tarjeta activa está arriba a la
// izquierda de la primera; "otra" está a su derecha en la misma fila.
function context(): Args {
  const droppableRects = new Map<string, ReturnType<typeof rect>>([
    ['col-1', rect(0, 0, 1000, 200)],
    ['col-2', rect(0, 220, 1000, 200)],
    ['activa', rect(10, 50, 240, 60)],
    ['otra', rect(260, 50, 240, 60)],
  ]);
  return {
    active: 'activa',
    currentCoordinates: { x: 10, y: 50 },
    context: {
      active: { id: 'activa' },
      collisionRect: rect(10, 50, 240, 60),
      droppableRects,
    },
  } as unknown as Args;
}

function press(key: string) {
  const event = new KeyboardEvent('keydown', { key });
  return boardKeyboardCoordinates(event, context());
}

describe('boardKeyboardCoordinates', () => {
  it('→ va a la tarjeta de la derecha en la misma columna', () => {
    expect(press('ArrowRight')).toEqual({ x: 260, y: 50 });
  });

  it('regresión: ↓ salta a la columna siguiente, no a la propia', () => {
    // El centro de col-1 (y=100) queda por debajo de la tarjeta (y=80): antes
    // se elegía col-1 y la tarjeta no cambiaba de columna.
    expect(press('ArrowDown')).toEqual({ x: 500 - 120, y: 320 - 30 });
  });

  it('regresión: ↓ ignora una tarjeta de la misma fila aunque esté un poco más abajo', () => {
    const args = context();
    args.context.droppableRects.set('misma-fila', rect(260, 50.5, 240, 60));
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    expect(boardKeyboardCoordinates(event, args)).toEqual({ x: 500 - 120, y: 320 - 30 });
  });

  it('← sin nada a la izquierda no mueve', () => {
    expect(press('ArrowLeft')).toBeUndefined();
  });

  it('ignora teclas que no son flechas', () => {
    expect(press('Enter')).toBeUndefined();
  });
});
