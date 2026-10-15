import { describe, it, expect } from 'vitest';
import { pillColorFor, pillClassesFor, avatarColorFor } from './badgeColors';

describe('pillColorFor / pillClassesFor', () => {
  it('es determinista: el mismo texto siempre da el mismo color', () => {
    expect(pillColorFor('urgente')).toBe(pillColorFor('urgente'));
    expect(pillClassesFor('urgente')).toBe(pillClassesFor('urgente'));
  });

  it('no distingue mayúsculas ni espacios al hashear', () => {
    expect(pillColorFor('Urgente')).toBe(pillColorFor(' urgente '));
  });
});

describe('avatarColorFor', () => {
  it('es determinista', () => {
    expect(avatarColorFor('Acme Inc.')).toBe(avatarColorFor('Acme Inc.'));
  });
});
