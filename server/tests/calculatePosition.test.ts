import { describe, it, expect } from '@jest/globals';
import { calculatePosition } from '../src/utils/calculatePosition.js';

describe('calculatePosition', () => {
  it('devuelve una posición inicial cuando la lista está vacía', () => {
    expect(calculatePosition(undefined, undefined)).toBe(1000);
  });

  it('se aleja hacia delante cuando solo hay un vecino anterior', () => {
    expect(calculatePosition(1000, undefined)).toBe(2000);
  });

  it('se acerca al origen cuando solo hay un vecino siguiente', () => {
    expect(calculatePosition(undefined, 1000)).toBe(500);
  });

  it('calcula el punto medio entre dos vecinos', () => {
    expect(calculatePosition(1000, 2000)).toBe(1500);
  });

  it('el resultado queda siempre estrictamente entre los vecinos', () => {
    const casos: Array<[number, number]> = [
      [1000, 1001],
      [0, 1],
      [-500, 500],
      [100, 100.0001],
    ];

    for (const [prev, next] of casos) {
      const position = calculatePosition(prev, next);
      expect(position).toBeGreaterThan(prev);
      expect(position).toBeLessThan(next);
    }
  });
});
