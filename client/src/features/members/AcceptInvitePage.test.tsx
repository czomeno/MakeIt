import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { deferred } from '../../test/deferred';
import { AcceptInvitePage } from './AcceptInvitePage';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route path="/boards/:id" element={<div>Tablero abierto</div>} />
      <Route path="/boards" element={<div>Mis tableros</div>} />
    </Routes>,
    { route: '/invite/token-123' },
  );
}

describe('AcceptInvitePage', () => {
  it('acepta la invitación con el token de la URL y abre el tablero', async () => {
    const response = deferred();
    const tokens: unknown[] = [];
    server.use(
      http.post('/api/invitations/accept', async ({ request }) => {
        tokens.push(await request.json());
        await response.promise;
        return HttpResponse.json({ boardId: 'board-9' });
      }),
    );
    renderPage();

    expect(screen.getByText('Comprobando tu invitación...')).toBeInTheDocument();
    response.resolve();
    expect(await screen.findByText('Tablero abierto')).toBeInTheDocument();
    expect(tokens[0]).toEqual({ token: 'token-123' });
  });

  it('si la invitación no es válida, explica el motivo y ofrece volver', async () => {
    server.use(
      http.post('/api/invitations/accept', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Esta invitación ha caducado' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'No hemos podido añadirte' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Esta invitación ha caducado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ir a mis tableros' }));
    expect(await screen.findByText('Mis tableros')).toBeInTheDocument();
  });
});
