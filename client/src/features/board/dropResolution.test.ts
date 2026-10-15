import { describe, it, expect } from 'vitest';
import type { Active, Over } from '@dnd-kit/core';
import { makeBoard, makeCard } from '../../test/fixtures';
import { applyCardMove, cardMoveApiInput } from './boardReducers';
import { resolveDrop, resolveFinalDrop } from './dropResolution';

const cardActive = (id: string, columnId: string) =>
  ({ id, data: { current: { type: 'card', columnId } } }) as unknown as Active;
const cardOver = (id: string, columnId: string) =>
  ({ id, data: { current: { type: 'card', columnId } } }) as unknown as Over;

describe('resolveFinalDrop', () => {
  const board = makeBoard([makeCard('a', 'col-1'), makeCard('b', 'col-1'), makeCard('c', 'col-1')]);
  const ids = (b: typeof board) => b.columns[0]!.cards.map((card) => card._id);

  it('regresión: soltar sobre el destino que ya aplicó onDragOver no deshace el movimiento', () => {
    // onDragOver: "a" sobre "b" → vista previa b, a, c.
    const over = cardOver('b', 'col-1');
    const overMove = resolveDrop(board, cardActive('a', 'col-1'), over)!;
    expect(overMove.kind).toBe('card');
    const preview = applyCardMove(board, overMove.kind === 'card' ? overMove.params : never());
    expect(ids(preview)).toEqual(['b', 'a', 'c']);

    // Al soltar (teclado: el over sigue siendo "b").
    const final = resolveFinalDrop(preview, cardActive('a', 'col-1'), over, 'b')!;
    if (final.kind !== 'card') throw new Error('esperaba una tarjeta');
    expect(ids(applyCardMove(preview, final.params))).toEqual(['b', 'a', 'c']);
    expect(cardMoveApiInput(preview, final.params)).toEqual({
      columnId: 'col-1',
      prevCardId: 'b',
      nextCardId: 'c',
    });
  });

  it('con un destino nuevo lo resuelve normalmente', () => {
    const final = resolveFinalDrop(board, cardActive('a', 'col-1'), cardOver('c', 'col-1'), 'b')!;
    if (final.kind !== 'card') throw new Error('esperaba una tarjeta');
    expect(ids(applyCardMove(board, final.params))).toEqual(['b', 'c', 'a']);
  });

  it('sin destino (soltado fuera) no hay movimiento', () => {
    expect(resolveFinalDrop(board, cardActive('a', 'col-1'), null, 'b')).toBeNull();
  });
});

function never(): never {
  throw new Error('inalcanzable');
}
