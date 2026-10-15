import { describe, it, expect } from 'vitest';
import { makeBoard, makeCard } from '../../test/fixtures';
import { upsertCard, removeCard, upsertColumn, removeColumn } from './remoteReducers';

const ids = (cards: { _id: string }[]) => cards.map((card) => card._id);

describe('remoteReducers (estado absoluto recibido por socket)', () => {
  const board = makeBoard([
    makeCard('a', 'col-1', { position: 1000 }),
    makeCard('b', 'col-1', { position: 2000 }),
  ]);

  it('upsertCard inserta una tarjeta nueva en su posición', () => {
    const next = upsertCard(board, makeCard('c', 'col-1', { position: 1500 }));
    expect(ids(next.columns[0]!.cards)).toEqual(['a', 'c', 'b']);
  });

  it('upsertCard mueve una tarjeta existente a otra columna sin duplicarla', () => {
    const next = upsertCard(board, makeCard('a', 'col-2', { position: 1000 }));
    expect(ids(next.columns[0]!.cards)).toEqual(['b']);
    expect(ids(next.columns[1]!.cards)).toEqual(['a']);
  });

  it('upsertCard reordena dentro de la misma columna según position', () => {
    const next = upsertCard(board, makeCard('a', 'col-1', { position: 3000 }));
    expect(ids(next.columns[0]!.cards)).toEqual(['b', 'a']);
  });

  it('upsertCard no toca nada si la columna destino no está en la cache', () => {
    expect(upsertCard(board, makeCard('z', 'col-desconocida'))).toBe(board);
  });

  it('removeCard quita la tarjeta', () => {
    expect(ids(removeCard(board, 'a').columns[0]!.cards)).toEqual(['b']);
  });

  it('upsertColumn añade una columna nueva ordenada y fusiona una existente', () => {
    const { cards: _cards, ...first } = board.columns[0]!;
    const added = upsertColumn(board, { ...first, _id: 'col-0', title: 'Antes', position: 500 });
    expect(added.columns.map((column) => column._id)).toEqual(['col-0', 'col-1', 'col-2']);
    expect(added.columns[0]!.cards).toEqual([]);

    const renamed = upsertColumn(board, { ...first, title: 'Renombrada' });
    expect(renamed.columns[0]!.title).toBe('Renombrada');
    expect(ids(renamed.columns[0]!.cards)).toEqual(['a', 'b']);
  });

  it('removeColumn quita la columna', () => {
    expect(removeColumn(board, 'col-1').columns.map((column) => column._id)).toEqual(['col-2']);
  });
});
