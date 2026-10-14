import { describe, it, expect } from 'vitest';
import { greetingFor } from './greeting';

describe('greetingFor', () => {
  it('saluda según la franja horaria', () => {
    expect(greetingFor(3)).toBe('Buenas noches');
    expect(greetingFor(9)).toBe('Buenos días');
    expect(greetingFor(15)).toBe('Buenas tardes');
    expect(greetingFor(22)).toBe('Buenas noches');
  });

  it('cubre los límites de cada franja', () => {
    expect(greetingFor(6)).toBe('Buenos días');
    expect(greetingFor(12)).toBe('Buenas tardes');
    expect(greetingFor(20)).toBe('Buenas noches');
  });
});
