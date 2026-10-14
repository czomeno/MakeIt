import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Board } from './Board';
import { createTestQueryClient } from '../../test/test-utils';
import type { BoardWithContent } from '../../types/api';

function makeBoard(): BoardWithContent {
  return {
    _id: 'board-1',
    title: 'Tablero',
    template: 'generic',
    owner: 'user-1',
    members: [{ user: 'user-1', role: 'viewer' }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    columns: [
      {
        _id: 'col-1',
        board: 'board-1',
        title: 'Por hacer',
        position: 1000,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cards: [
          {
            _id: 'card-1',
            board: 'board-1',
            column: 'col-1',
            title: 'Tarjeta',
            position: 1000,
            labels: [],
            assignees: [],
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
      },
    ],
  };
}

function renderBoard(canEdit: boolean) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <Board board={makeBoard()} canEdit={canEdit} onOpenCard={() => undefined} />
    </QueryClientProvider>,
  );
}

describe('Board — permisos de arrastre', () => {
  it('un viewer no puede iniciar un arrastre: la tarjeta queda deshabilitada para dnd-kit', () => {
    renderBoard(false);

    const card = screen.getByRole('button', { name: 'Tarjeta' });
    expect(card).toHaveAttribute('aria-disabled', 'true');

    // La columna tampoco es arrastrable: su asa (el título) ni siquiera
    // recibe los atributos de dnd-kit, y además queda nativamente disabled.
    const columnTitle = screen.getByRole('button', { name: 'Por hacer' });
    expect(columnTitle).toBeDisabled();
  });

  it('un editor sí puede iniciar un arrastre: dnd-kit deja la tarjeta habilitada', () => {
    renderBoard(true);

    const card = screen.getByRole('button', { name: 'Tarjeta' });
    expect(card).toHaveAttribute('aria-disabled', 'false');

    const columnTitle = screen.getByRole('button', { name: 'Por hacer' });
    expect(columnTitle).not.toBeDisabled();
  });
});
