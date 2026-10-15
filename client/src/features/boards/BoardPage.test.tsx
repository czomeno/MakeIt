import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { fakeSocket } from '../../test/socketMock';
import { BoardPage } from './BoardPage';
import { Toaster } from '../../components/Toaster';
import { useAuthStore } from '../../stores/authStore';
import { useViewPreferenceStore } from '../../stores/viewPreferenceStore';
import { TEST_USER } from '../../test/handlers';
import type { BoardWithContent, BoardRole } from '../../types/api';

function signIn() {
  useAuthStore.setState({ status: 'authenticated', user: TEST_USER, accessToken: 'token' });
}

function renderBoard() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/boards/:id" element={<BoardPage />} />
      </Routes>
      <Toaster />
    </>,
    { route: '/boards/board-1' },
  );
}

function makeBoard(role: BoardRole): BoardWithContent {
  return {
    _id: 'board-1',
    title: 'Candidaturas',
    description: '',
    template: 'generic',
    owner: TEST_USER.id,
    members: [{ user: TEST_USER.id, role }],
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
            title: 'Primera',
            position: 1000,
            labels: [],
            assignees: [],
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
          {
            _id: 'card-2',
            board: 'board-1',
            column: 'col-1',
            title: 'Segunda',
            position: 2000,
            labels: [],
            assignees: [],
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
      },
      {
        _id: 'col-2',
        board: 'board-1',
        title: 'Hecho',
        position: 2000,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cards: [],
      },
    ],
  };
}

// GET siempre devuelve el estado mutable actual: así las mutaciones que
// invalidan la query (crear/editar/borrar) se ven reflejadas en el refetch,
// igual que contra la API real.
function mockBoardServer(initialBoard: BoardWithContent) {
  let board = initialBoard;

  server.use(
    http.get('/api/boards/board-1', () => HttpResponse.json({ board })),

    http.post('/api/columns/:columnId/cards', async ({ params, request }) => {
      const body = (await request.json()) as { title: string };
      const column = board.columns.find((c) => c._id === params.columnId);
      if (!column) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'no encontrada' } },
          { status: 404 },
        );
      }
      const card = {
        _id: `card-${Math.random().toString(36).slice(2)}`,
        board: board._id,
        column: column._id,
        title: body.title,
        position: (column.cards.at(-1)?.position ?? 0) + 1000,
        labels: [] as string[],
        assignees: [] as string[],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      board = {
        ...board,
        columns: board.columns.map((c) =>
          c._id === column._id ? { ...c, cards: [...c.cards, card] } : c,
        ),
      };
      return HttpResponse.json({ card }, { status: 201 });
    }),

    http.patch('/api/cards/:id', async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      let updated = null;
      board = {
        ...board,
        columns: board.columns.map((column) => ({
          ...column,
          cards: column.cards.map((card) => {
            if (card._id !== params.id) return card;
            updated = { ...card, ...body };
            return updated;
          }),
        })),
      };
      if (!updated) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'no encontrada' } },
          { status: 404 },
        );
      }
      return HttpResponse.json({ card: updated });
    }),

    http.delete('/api/columns/:id', ({ params }) => {
      board = { ...board, columns: board.columns.filter((c) => c._id !== params.id) };
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

describe('BoardPage: vista inicial', () => {
  it('abre en la vista de lista y recuerda el cambio a tablero', async () => {
    signIn();
    mockBoardServer(makeBoard('editor'));
    const user = userEvent.setup();

    renderBoard();

    expect(await screen.findByRole('list', { name: 'Tareas' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Lista' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByLabelText('Añadir tarjeta a Hecho')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Tablero' }));

    expect(await screen.findByLabelText('Añadir tarjeta a Hecho')).toBeInTheDocument();
    expect(useViewPreferenceStore.getState().boardView).toBe('board');
    expect(localStorage.getItem('makeit-board-view')).toContain('"board"');
  });
});

describe('BoardPage: añadir tarea o candidatura', () => {
  it('el botón junto a Lista/Tablero abre el pop-up de nueva tarea', async () => {
    signIn();
    mockBoardServer(makeBoard('editor'));
    const user = userEvent.setup();
    renderBoard();

    const viewSwitch = await screen.findByRole('radiogroup', { name: 'Vista del tablero' });
    const addButton = screen.getByRole('button', { name: 'Añadir tarea' });
    expect(viewSwitch.parentElement).toContainElement(addButton);

    await user.click(addButton);
    expect(screen.getByRole('dialog', { name: 'Nueva tarea' })).toBeInTheDocument();
  });

  it('en un tablero de candidaturas dice «Añadir candidatura»', async () => {
    signIn();
    mockBoardServer({ ...makeBoard('editor'), template: 'job-applications' });
    const user = userEvent.setup();
    renderBoard();

    await user.click(await screen.findByRole('button', { name: 'Añadir candidatura' }));
    const dialog = screen.getByRole('dialog', { name: 'Nueva candidatura' });
    expect(within(dialog).getByLabelText('Empresa')).toBeInTheDocument();
  });

  it('un lector no ve el botón', async () => {
    signIn();
    mockBoardServer(makeBoard('viewer'));
    renderBoard();

    expect(
      await screen.findByRole('radiogroup', { name: 'Vista del tablero' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Añadir tarea' })).toBeNull();
  });
});

describe('BoardPage', () => {
  // Estos tests prueban la vista de tablero (columnas y arrastre).
  beforeEach(() => {
    useViewPreferenceStore.setState({ boardView: 'board' });
  });

  it('renderiza columnas y tarjetas en el orden del backend', async () => {
    signIn();
    mockBoardServer(makeBoard('editor'));

    renderBoard();

    expect(await screen.findByText('Por hacer')).toBeInTheDocument();
    expect(screen.getByText('Hecho')).toBeInTheDocument();

    const primera = screen.getByText('Primera');
    const segunda = screen.getByText('Segunda');
    expect(
      primera.compareDocumentPosition(segunda) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('crea una tarjeta desde el alta rápida de una columna', async () => {
    signIn();
    mockBoardServer(makeBoard('editor'));
    const user = userEvent.setup();

    renderBoard();
    await screen.findByText('Hecho');

    const input = screen.getByLabelText('Añadir tarjeta a Hecho');
    await user.type(input, 'Tarea nueva{Enter}');

    expect(await screen.findByText('Tarea nueva')).toBeInTheDocument();
  });

  it('edita una tarjeta desde el modal de detalle', async () => {
    signIn();
    mockBoardServer(makeBoard('editor'));
    const user = userEvent.setup();

    renderBoard();
    await user.click(await screen.findByRole('button', { name: 'Primera' }));

    const dialog = await screen.findByRole('dialog');
    const titleInput = within(dialog).getByLabelText('Título');
    await user.clear(titleInput);
    await user.type(titleInput, 'Primera editada');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Tarjeta actualizada.')).toBeInTheDocument();
    expect(await screen.findByText('Primera editada')).toBeInTheDocument();
  });

  it('borra una columna con confirmación, avisando de las tarjetas que se pierden', async () => {
    signIn();
    mockBoardServer(makeBoard('editor'));
    const user = userEvent.setup();

    renderBoard();
    await screen.findByText('Por hacer');

    await user.click(screen.getByRole('button', { name: 'Borrar columna Por hacer' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/2 tarjetas/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Borrar columna' }));

    expect(screen.queryByText('Por hacer')).not.toBeInTheDocument();
    expect(screen.getByText('Hecho')).toBeInTheDocument();
  });

  it('un viewer no ve controles de edición', async () => {
    signIn();
    mockBoardServer(makeBoard('viewer'));

    renderBoard();
    await screen.findByText('Por hacer');

    expect(screen.queryByText('Nueva columna')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Añadir tarjeta a/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Borrar columna/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar tablero' })).not.toBeInTheDocument();
  });

  it('muestra la pantalla de "sin acceso" si un evento de socket avisa de que me han expulsado', async () => {
    signIn();
    mockBoardServer(makeBoard('editor'));

    renderBoard();
    await screen.findByText('Por hacer');
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('member:removed', { userId: TEST_USER.id, actorId: 'otro-admin' });
    });

    expect(await screen.findByText('Ya no tienes acceso a este tablero')).toBeInTheDocument();
    expect(screen.queryByText('Por hacer')).not.toBeInTheDocument();
  });

  it('refleja al instante una tarjeta editada por otro usuario vía socket', async () => {
    signIn();
    mockBoardServer(makeBoard('editor'));

    renderBoard();
    await screen.findByText('Primera');
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => {
      fakeSocket.trigger('card:updated', {
        card: {
          _id: 'card-1',
          board: 'board-1',
          column: 'col-1',
          title: 'Primera (editada por otro)',
          position: 1000,
          labels: [],
          assignees: [],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        actorId: 'otro-usuario',
        clientId: 'otra-pestana',
      });
    });

    expect(await screen.findByText('Primera (editada por otro)')).toBeInTheDocument();
  });
});
