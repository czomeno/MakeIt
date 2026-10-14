import { http, HttpResponse } from 'msw';
import type { User } from '../types/api';

export const TEST_USER: User = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const TEST_PASSWORD = 'password123456';

// Handlers por defecto (camino feliz). Cada test los sobreescribe con
// server.use(...) para los casos que necesita.
export const handlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { name: string; email: string };
    return HttpResponse.json(
      {
        user: { ...TEST_USER, name: body.name, email: body.email },
        accessToken: 'test-access-token',
      },
      { status: 201 },
    );
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== TEST_PASSWORD) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Credenciales inválidas' } },
        { status: 401 },
      );
    }
    return HttpResponse.json({ user: TEST_USER, accessToken: 'test-access-token' });
  }),

  // Sin sesión por defecto: cada test que simule "ya hay sesión" la fija
  // directamente en el store en vez de depender de este endpoint.
  http.post('/api/auth/refresh', () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Falta el refresh token' } },
      { status: 401 },
    ),
  ),

  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/auth/me', () => HttpResponse.json({ user: TEST_USER })),

  http.get('/api/boards', () => HttpResponse.json({ boards: [] })),

  // Camino feliz para miembros/invitaciones/actividad: listas vacías por
  // defecto, cada test que necesite datos concretos los sobreescribe con
  // server.use(...).
  http.get('/api/boards/:boardId/members', () => HttpResponse.json({ members: [] })),
  http.get('/api/boards/:boardId/invitations', () => HttpResponse.json({ invitations: [] })),
  http.get('/api/boards/:boardId/activity', () =>
    HttpResponse.json({ items: [], nextCursor: null }),
  ),
  http.get('/api/cards/:cardId/activity', () =>
    HttpResponse.json({ items: [], nextCursor: null }),
  ),
];
