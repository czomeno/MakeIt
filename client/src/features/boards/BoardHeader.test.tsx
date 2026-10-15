import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardHeader } from './BoardHeader';
import { makeBoard } from '../../test/fixtures';
import type { ConnectionStatus } from '../board/useBoardSocket';

function renderHeader(connectionStatus: ConnectionStatus) {
  render(
    <BoardHeader
      board={makeBoard()}
      isAdmin={false}
      onEdit={() => {}}
      onDelete={() => {}}
      onOpenCollaboration={() => {}}
      connectionStatus={connectionStatus}
    />,
  );
}

describe('BoardHeader', () => {
  it('con la conexión en marcha no muestra ningún indicador', () => {
    renderHeader('connected');
    expect(screen.queryByText('En vivo')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('avisa cuando se pierde la conexión', () => {
    renderHeader('reconnecting');
    expect(screen.getByRole('status')).toHaveTextContent('Reconectando…');
  });
});
