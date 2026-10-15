import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { MembersPanel } from './MembersPanel';
import { Toaster } from '../../components/Toaster';
import { useAuthStore } from '../../stores/authStore';
import type { Member } from '../../types/api';

const OWNER: Member = {
  userId: 'user-owner',
  role: 'admin',
  name: 'Owner',
  email: 'owner@example.com',
};
const EDITOR: Member = {
  userId: 'user-editor',
  role: 'editor',
  name: 'Edi Tor',
  email: 'edi@example.com',
};

function signInAs(userId: string) {
  useAuthStore.setState({
    status: 'authenticated',
    user: { id: userId, name: 'Me', email: 'me@example.com', createdAt: '2024-01-01' },
    accessToken: 'token',
  });
}

function mockMembers(initial: Member[]) {
  let members = initial;
  server.use(
    http.get('/api/boards/board-1/members', () => HttpResponse.json({ members })),
    http.patch('/api/boards/board-1/members/:userId', async ({ params, request }) => {
      const body = (await request.json()) as { role: Member['role'] };
      members = members.map((m) => (m.userId === params.userId ? { ...m, role: body.role } : m));
      const member = members.find((m) => m.userId === params.userId);
      return HttpResponse.json({ member });
    }),
    http.delete('/api/boards/board-1/members/:userId', ({ params }) => {
      members = members.filter((m) => m.userId !== params.userId);
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

function renderPanel(isAdmin: boolean) {
  return renderWithProviders(
    <>
      <MembersPanel boardId="board-1" isAdmin={isAdmin} ownerId={OWNER.userId} />
      <Toaster />
    </>,
  );
}

describe('MembersPanel', () => {
  it('un admin puede cambiar el rol de otro miembro', async () => {
    signInAs(OWNER.userId);
    mockMembers([OWNER, EDITOR]);
    const user = userEvent.setup();

    renderPanel(true);
    await screen.findByText('Edi Tor');

    await user.click(screen.getByRole('button', { name: 'Rol de Edi Tor: Editor' }));
    await user.click(screen.getByRole('option', { name: 'Lector' }));

    expect(
      await screen.findByRole('button', { name: 'Rol de Edi Tor: Lector' }),
    ).toBeInTheDocument();
  });

  it('un no-admin no ve selector de rol, solo la etiqueta', async () => {
    signInAs(EDITOR.userId);
    mockMembers([OWNER, EDITOR]);

    renderPanel(false);
    await screen.findByText('Edi Tor');

    expect(screen.queryByRole('button', { name: /^Rol de Edi Tor/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Editor')).not.toHaveLength(0);
  });

  it('el propietario no tiene botón de expulsar ni selector de rol, aunque lo vea un admin', async () => {
    signInAs(OWNER.userId);
    mockMembers([OWNER, EDITOR]);

    renderPanel(true);
    await screen.findByText('Edi Tor');

    expect(screen.queryByLabelText(/Expulsar a Owner/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Abandonar tablero')).not.toBeInTheDocument();
    expect(screen.getByText(/Propietario/)).toBeInTheDocument();
  });

  it('un admin expulsa a otro miembro tras confirmar', async () => {
    signInAs(OWNER.userId);
    mockMembers([OWNER, EDITOR]);
    const user = userEvent.setup();

    renderPanel(true);
    await screen.findByText('Edi Tor');

    await user.click(screen.getByLabelText('Expulsar a Edi Tor'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Expulsar' }));

    expect(await screen.findByText('Miembro expulsado.')).toBeInTheDocument();
    expect(screen.queryByText('Edi Tor')).not.toBeInTheDocument();
  });

  it('un miembro puede abandonar el tablero por sí mismo', async () => {
    signInAs(EDITOR.userId);
    mockMembers([OWNER, EDITOR]);
    const user = userEvent.setup();

    renderPanel(false);
    await screen.findByText('Edi Tor');

    await user.click(screen.getByLabelText('Abandonar tablero'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/abandonar este tablero/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Abandonar' }));

    expect(await screen.findByText('Has abandonado el tablero.')).toBeInTheDocument();
  });
});
