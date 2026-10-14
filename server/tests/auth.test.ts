import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser } from './helpers/factories.js';

const app = createApp();

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('POST /api/auth/register', () => {
  it('crea un usuario y devuelve access token + cookie de refresh', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'password123' });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.headers['set-cookie']?.[0]).toMatch(/refreshToken=/);
  });

  it('rechaza un email duplicado', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'duplicado@example.com', password: 'password123' });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Otra Ada', email: 'duplicado@example.com', password: 'password123' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('rechaza datos inválidos', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'no-es-un-email', password: '123' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  it('devuelve access token con credenciales correctas', async () => {
    await registerUser(app, { email: 'login@example.com', password: 'password123' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(typeof response.body.accessToken).toBe('string');
  });

  it('rechaza una contraseña incorrecta', async () => {
    await registerUser(app, { email: 'login2@example.com', password: 'password123' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login2@example.com', password: 'incorrecta' });

    expect(response.status).toBe(401);
  });

  it('rechaza un email que no existe', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@example.com', password: 'password123' });

    expect(response.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('rechaza la petición sin token', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('devuelve el usuario autenticado con un token válido', async () => {
    const { accessToken, email } = await registerUser(app);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(email);
  });

  it('rechaza un token manipulado', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-invalido');
    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/refresh y /api/auth/logout', () => {
  it('rota el refresh token y emite un access token nuevo', async () => {
    // No se compara el access token con el anterior: con el mismo payload
    // emitido en el mismo segundo, el JWT es determinista y puede coincidir.
    const { refreshTokenCookie } = await registerUser(app);

    const response = await request(app).post('/api/auth/refresh').set('Cookie', refreshTokenCookie);

    expect(response.status).toBe(200);
    expect(typeof response.body.accessToken).toBe('string');

    const newCookie = response.headers['set-cookie']?.[0];
    expect(newCookie).toMatch(/refreshToken=/);
    expect(newCookie).not.toBe(refreshTokenCookie);
  });

  it('invalida el refresh token usado (rotación): no se puede reutilizar', async () => {
    const { refreshTokenCookie } = await registerUser(app);

    await request(app).post('/api/auth/refresh').set('Cookie', refreshTokenCookie);
    const second = await request(app).post('/api/auth/refresh').set('Cookie', refreshTokenCookie);

    expect(second.status).toBe(401);
  });

  it('rechaza /refresh sin cookie', async () => {
    const response = await request(app).post('/api/auth/refresh');
    expect(response.status).toBe(401);
  });

  it('logout invalida el refresh token activo', async () => {
    const { refreshTokenCookie } = await registerUser(app);

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshTokenCookie);
    expect(logoutResponse.status).toBe(204);

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshTokenCookie);
    expect(refreshResponse.status).toBe(401);
  });
});
