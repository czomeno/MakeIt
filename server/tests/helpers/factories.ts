import type { Express } from 'express';
import request from 'supertest';

interface RegisteredUser {
  accessToken: string;
  refreshTokenCookie: string;
  userId: string;
  email: string;
}

// Registra un usuario y devuelve su access token + cookie de refresh,
// listos para usar en las peticiones autenticadas de cada test.
export async function registerUser(
  app: Express,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<RegisteredUser> {
  const email =
    overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: overrides.name ?? 'Usuaria de Prueba',
      email,
      password: overrides.password ?? 'password123',
    });

  const cookies: string[] = Array.isArray(response.headers['set-cookie'])
    ? response.headers['set-cookie']
    : response.headers['set-cookie']
      ? [response.headers['set-cookie']]
      : [];
  const refreshTokenCookie = cookies.find((cookie) => cookie.startsWith('refreshToken=')) ?? '';

  return {
    accessToken: response.body.accessToken as string,
    refreshTokenCookie,
    userId: response.body.user.id as string,
    email,
  };
}

export async function createBoard(
  app: Express,
  accessToken: string,
  overrides: Partial<{
    title: string;
    description: string;
    template: 'generic' | 'job-applications';
  }> = {},
) {
  const response = await request(app)
    .post('/api/boards')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      title: overrides.title ?? 'Tablero de prueba',
      description: overrides.description,
      template: overrides.template ?? 'generic',
    });
  return response.body.board;
}
