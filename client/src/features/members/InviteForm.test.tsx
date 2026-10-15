import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { InviteForm } from './InviteForm';
import { Toaster } from '../../components/Toaster';
import type { Invitation } from '../../types/api';

function mockInvitations(initial: Invitation[]) {
  let invitations = initial;
  server.use(
    http.get('/api/boards/board-1/invitations', () => HttpResponse.json({ invitations })),
    http.post('/api/boards/board-1/invitations', async ({ request }) => {
      const body = (await request.json()) as { email: string; role: Invitation['role'] };
      const invitation: Invitation = {
        id: `inv-${invitations.length + 1}`,
        email: body.email,
        role: body.role,
        status: 'pending',
        expiresAt: '2024-12-31T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      invitations = [invitation, ...invitations];
      return HttpResponse.json(
        { invitation, link: `http://localhost:5173/invite/raw-token-${invitation.id}` },
        { status: 201 },
      );
    }),
    http.delete('/api/invitations/:id', ({ params }) => {
      invitations = invitations.filter((i) => i.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

function renderForm() {
  return renderWithProviders(
    <>
      <InviteForm boardId="board-1" />
      <Toaster />
    </>,
  );
}

describe('InviteForm', () => {
  it('crea una invitación y muestra el enlace con botón de copiar', async () => {
    mockInvitations([]);
    const user = userEvent.setup();
    // userEvent.setup() instala su propio navigator.clipboard simulado (para
    // sus propias user.copy()/paste()); hay que pisarlo DESPUÉS de crearlo.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderForm();
    await screen.findByText('No hay invitaciones pendientes.');

    await user.type(screen.getByLabelText('Email'), 'nuevo@example.com');
    await user.selectOptions(screen.getByLabelText('Rol'), 'viewer');
    await user.click(screen.getByRole('button', { name: 'Invitar' }));

    expect(await screen.findByText('Invitación creada.')).toBeInTheDocument();
    const linkInput = screen.getByLabelText('Enlace de invitación') as HTMLInputElement;
    expect(linkInput.value).toContain('/invite/raw-token-inv-1');

    await user.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(writeText).toHaveBeenCalledWith(linkInput.value);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();

    expect(await screen.findByText(/nuevo@example.com/)).toBeInTheDocument();
  });

  it('revoca una invitación pendiente tras confirmar', async () => {
    mockInvitations([
      {
        id: 'inv-1',
        email: 'pendiente@example.com',
        role: 'editor',
        status: 'pending',
        expiresAt: '2024-12-31T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    const user = userEvent.setup();

    renderForm();
    await screen.findByText(/pendiente@example.com/);

    await user.click(screen.getByRole('button', { name: 'Revocar' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Revocar' }));

    expect(await screen.findByText('Invitación revocada.')).toBeInTheDocument();
    expect(screen.queryByText(/pendiente@example.com/)).not.toBeInTheDocument();
  });
});
