import { describe, it, expect } from 'vitest';
import type { Active, Over } from '@dnd-kit/core';
import { makeBoard, makeCard } from '../../test/fixtures';
import { createAnnouncements } from './announcements';

// Solo importan los ids: dnd-kit pasa objetos más ricos, pero los anuncios
// para lectores de pantalla solo leen active.id y over.id.
const active = (id: string) => ({ id }) as Active;
const over = (id: string) => ({ id }) as Over;

describe('anuncios de arrastre para lectores de pantalla', () => {
  const board = makeBoard([makeCard('a', 'col-1', { title: 'Informe' })]);
  const a = createAnnouncements(board);

  it('describe una tarjeta durante todo el arrastre', () => {
    expect(a.onDragStart({ active: active('a') })).toBe(
      'Tarjeta Informe recogida de la columna Por hacer.',
    );
    expect(a.onDragOver({ active: active('a'), over: over('col-2') })).toBe(
      'Tarjeta Informe sobre la columna Hecho.',
    );
    expect(a.onDragEnd({ active: active('a'), over: over('col-2') })).toBe(
      'Tarjeta Informe soltada en la columna Hecho.',
    );
    expect(a.onDragEnd({ active: active('a'), over: null })).toBe(
      'Movimiento de la tarjeta Informe cancelado.',
    );
    expect(a.onDragCancel({ active: active('a'), over: null })).toBe(
      'Movimiento de la tarjeta Informe cancelado.',
    );
  });

  it('describe una columna durante todo el arrastre', () => {
    expect(a.onDragStart({ active: active('col-1') })).toBe('Columna Por hacer recogida.');
    expect(a.onDragOver({ active: active('col-1'), over: over('col-2') })).toBe(
      'Columna Por hacer sobre la posición 2.',
    );
    expect(a.onDragEnd({ active: active('col-1'), over: over('col-2') })).toBe(
      'Columna Por hacer soltada.',
    );
    expect(a.onDragCancel({ active: active('col-1'), over: null })).toBe(
      'Movimiento de la columna Por hacer cancelado.',
    );
  });
});
