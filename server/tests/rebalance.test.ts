import { describe, it, expect } from '@jest/globals';
import { needsRebalance, rebalancedPositions, POSITION_GAP } from '../src/utils/rebalance.js';

describe('needsRebalance', () => {
  it('false si falta algún vecino', () => {
    expect(needsRebalance(undefined, 1000)).toBe(false);
    expect(needsRebalance(1000, undefined)).toBe(false);
    expect(needsRebalance(undefined, undefined)).toBe(false);
  });

  it('false con un hueco normal', () => {
    expect(needsRebalance(1000, 2000)).toBe(false);
  });

  it('true cuando el hueco baja del umbral', () => {
    expect(needsRebalance(1000, 1000.5)).toBe(true);
  });

  it('false justo en el umbral (hueco == 1)', () => {
    expect(needsRebalance(1000, 1001)).toBe(false);
  });
});

describe('rebalancedPositions', () => {
  it('renumera todos los ids con hueco uniforme, con el movido insertado', () => {
    const positions = rebalancedPositions(['a', 'b', 'c'], 1, 'movido');

    expect([...positions.entries()]).toEqual([
      ['a', POSITION_GAP],
      ['movido', POSITION_GAP * 2],
      ['b', POSITION_GAP * 3],
      ['c', POSITION_GAP * 4],
    ]);
  });

  it('inserta al final si el índice se pasa de la lista', () => {
    const positions = rebalancedPositions(['a'], 99, 'movido');
    expect([...positions.entries()]).toEqual([
      ['a', POSITION_GAP],
      ['movido', POSITION_GAP * 2],
    ]);
  });

  it('inserta al principio con índice 0', () => {
    const positions = rebalancedPositions(['a', 'b'], 0, 'movido');
    expect([...positions.entries()]).toEqual([
      ['movido', POSITION_GAP],
      ['a', POSITION_GAP * 2],
      ['b', POSITION_GAP * 3],
    ]);
  });
});
