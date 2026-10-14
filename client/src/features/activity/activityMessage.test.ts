import { describe, it, expect } from 'vitest';
import { activityMessage } from './activityMessage';
import type { ActivityItem } from '../../types/api';

function makeItem(overrides: Partial<ActivityItem>): ActivityItem {
  return {
    _id: 'activity-1',
    board: 'board-1',
    actor: { _id: 'user-1', name: 'Ana', email: 'ana@example.com' },
    type: 'card.created',
    data: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('activityMessage', () => {
  it('card.created', () => {
    const msg = activityMessage(
      makeItem({ type: 'card.created', data: { cardTitle: 'Diseñar logo', columnTitle: 'Por hacer' } }),
    );
    expect(msg).toBe('Ana creó «Diseñar logo» en Por hacer');
  });

  it('card.moved entre columnas distintas', () => {
    const msg = activityMessage(
      makeItem({
        type: 'card.moved',
        data: { cardTitle: 'Diseñar logo', fromColumnTitle: 'En curso', toColumnTitle: 'Hecho' },
      }),
    );
    expect(msg).toBe('Ana movió «Diseñar logo» de En curso a Hecho');
  });

  it('card.moved dentro de la misma columna se describe como reordenar', () => {
    const msg = activityMessage(
      makeItem({
        type: 'card.moved',
        data: { cardTitle: 'Diseñar logo', fromColumnTitle: 'Hecho', toColumnTitle: 'Hecho' },
      }),
    );
    expect(msg).toBe('Ana reordenó «Diseñar logo» en Hecho');
  });

  it('member.role_changed traduce el rol', () => {
    const msg = activityMessage(
      makeItem({ type: 'member.role_changed', data: { memberName: 'Bea', newRole: 'viewer' } }),
    );
    expect(msg).toBe('Ana cambió el rol de Bea a lector');
  });

  it('usa "Alguien" cuando el actor ya no existe', () => {
    const msg = activityMessage(
      makeItem({ type: 'card.deleted', actor: null, data: { cardTitle: 'Tarea' } }),
    );
    expect(msg).toBe('Alguien borró «Tarea»');
  });
});
