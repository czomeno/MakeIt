import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { deferred } from '../../test/deferred';
import { makeActivity } from '../../test/fixtures';
import { ActivityPanel } from './ActivityPanel';

describe('ActivityPanel', () => {
  it('muestra un indicador de carga mientras llega la actividad', async () => {
    const response = deferred();
    server.use(
      http.get('/api/boards/:boardId/activity', async () => {
        await response.promise;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    renderWithProviders(<ActivityPanel boardId="board-1" enabled />);

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    response.resolve();
    expect(
      await screen.findByText('Todavía no hay actividad en este tablero.'),
    ).toBeInTheDocument();
  });

  it('muestra un error si la petición falla', async () => {
    server.use(
      http.get('/api/boards/:boardId/activity', () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<ActivityPanel boardId="board-1" enabled />);
    expect(await screen.findByText('No se pudo cargar la actividad.')).toBeInTheDocument();
  });

  it('pagina con "Cargar más" usando el cursor', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get('/api/boards/:boardId/activity', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return cursor
          ? HttpResponse.json({ items: [makeActivity('b')], nextCursor: null })
          : HttpResponse.json({ items: [makeActivity('a')], nextCursor: 'cursor-1' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ActivityPanel boardId="board-1" enabled />);

    expect(await screen.findByText(/Ada creó «Tarjeta a»/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText(/Ada creó «Tarjeta b»/)).toBeInTheDocument();
    expect(cursors).toEqual([null, 'cursor-1']);
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('no pide nada ni muestra nada si está deshabilitado', () => {
    let calls = 0;
    server.use(
      http.get('/api/boards/:boardId/activity', () => {
        calls += 1;
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    const { container } = renderWithProviders(<ActivityPanel boardId="board-1" enabled={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(calls).toBe(0);
  });
});
