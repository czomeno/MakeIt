import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { CollaborationModal } from './CollaborationModal';

function mockEmptyMembers() {
  server.use(
    http.get('/api/boards/board-1/members', () =>
      HttpResponse.json({
        members: [{ userId: 'u1', role: 'admin', name: 'Ana', email: 'ana@example.com' }],
      }),
    ),
    http.get('/api/boards/board-1/invitations', () => HttpResponse.json({ invitations: [] })),
  );
}

describe('CollaborationModal', () => {
  it('un admin ve la pestaña Invitar', async () => {
    mockEmptyMembers();
    renderWithProviders(
      <CollaborationModal boardId="board-1" ownerId="u1" isAdmin isOpen onClose={() => {}} />,
    );
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Invitar' })).toBeInTheDocument();
  });

  it('un viewer/editor no ve la pestaña Invitar ni sus controles', async () => {
    mockEmptyMembers();
    renderWithProviders(
      <CollaborationModal
        boardId="board-1"
        ownerId="u1"
        isAdmin={false}
        isOpen
        onClose={() => {}}
      />,
    );
    await screen.findByText('Ana');
    expect(screen.queryByRole('tab', { name: 'Invitar' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('cambia de pestaña y marca la activa con aria-selected', async () => {
    mockEmptyMembers();
    const user = userEvent.setup();
    renderWithProviders(
      <CollaborationModal boardId="board-1" ownerId="u1" isAdmin isOpen onClose={() => {}} />,
    );
    await screen.findByText('Ana');

    await user.click(screen.getByRole('tab', { name: 'Actividad' }));
    expect(screen.getByRole('tab', { name: 'Actividad' })).toHaveAttribute('aria-selected', 'true');
    expect(
      await screen.findByText('Todavía no hay actividad en este tablero.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Invitar' }));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
