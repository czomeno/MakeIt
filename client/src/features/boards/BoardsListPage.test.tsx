import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { renderWithProviders } from '../../test/test-utils';
import { BoardsListPage } from './BoardsListPage';
import { CreateBoardModal } from './CreateBoardModal';
import { Toaster } from '../../components/Toaster';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { TEST_USER } from '../../test/handlers';

// El modal de creación vive en AppLayout (global, abierto desde el sidebar o
// desde el estado vacío); aquí se simula ese mismo cableado vía el store
// compartido, sin montar todo AppLayout (auth, logout, sidebar...).
function BoardsListPageWithCreateModal() {
  const isOpen = useUiStore((state) => state.isCreateBoardOpen);
  const close = useUiStore((state) => state.closeCreateBoard);
  return (
    <>
      <BoardsListPage />
      <CreateBoardModal isOpen={isOpen} onClose={close} />
      <Toaster />
    </>
  );
}

function signIn() {
  useAuthStore.setState({ status: 'authenticated', user: TEST_USER, accessToken: 'token' });
}

describe('BoardsListPage', () => {
  it('muestra el estado vacío con llamada a la acción', async () => {
    signIn();
    server.use(http.get('/api/boards', () => HttpResponse.json({ boards: [] })));

    renderWithProviders(<BoardsListPage />);

    expect(await screen.findByText('Todavía no tienes tableros')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear mi primer tablero' })).toBeInTheDocument();
  });

  it('muestra los tableros del usuario con su rol', async () => {
    signIn();
    server.use(
      http.get('/api/boards', () =>
        HttpResponse.json({
          boards: [
            {
              _id: 'board-1',
              title: 'Candidaturas',
              description: 'Mi búsqueda activa',
              template: 'job-applications',
              owner: TEST_USER.id,
              members: [{ user: TEST_USER.id, role: 'admin' }],
              createdAt: '2024-01-01',
              updatedAt: '2024-01-01',
            },
          ],
        }),
      ),
    );

    renderWithProviders(<BoardsListPage />);

    expect(await screen.findByText('Candidaturas')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Candidaturas de empleo')).toBeInTheDocument();
  });

  it('crea un tablero desde el modal', async () => {
    signIn();
    const user = userEvent.setup();
    server.use(
      http.get('/api/boards', () => HttpResponse.json({ boards: [] })),
      http.post('/api/boards', async ({ request }) => {
        const body = (await request.json()) as { title: string; template: string };
        return HttpResponse.json(
          {
            board: {
              _id: 'new-board',
              title: body.title,
              template: body.template,
              owner: TEST_USER.id,
              members: [{ user: TEST_USER.id, role: 'admin' }],
              createdAt: '2024-01-01',
              updatedAt: '2024-01-01',
            },
          },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<BoardsListPageWithCreateModal />);
    await screen.findByText('Todavía no tienes tableros');

    await user.click(screen.getByRole('button', { name: 'Crear mi primer tablero' }));
    await user.type(screen.getByLabelText('Título'), 'Mi nuevo tablero');
    await user.click(screen.getByRole('button', { name: 'Crear tablero' }));

    expect(await screen.findByText('Tablero creado.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
