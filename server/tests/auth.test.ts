import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser } from './helpers/factories.js';
import { User } from '../src/models/User.js';

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

describe('auth: casos límite', () => {
  it('nunca devuelve el hash de la contraseña', async () => {
    const { email } = await registerUser(app);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });
    expect(login.status).toBe(200);
    expect(JSON.stringify(login.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('la cookie de refresh es httpOnly', async () => {
    const { refreshTokenCookie } = await registerUser(app);
    expect(refreshTokenCookie).toMatch(/HttpOnly/i);
  });

  it('rechaza /refresh con un token con firma manipulada', async () => {
    const { refreshTokenCookie } = await registerUser(app);
    const tampered = refreshTokenCookie.replace(/refreshToken=([^;]+)/, (_m, value: string) => {
      return `refreshToken=${value.slice(0, -2)}xx`;
    });
    const response = await request(app).post('/api/auth/refresh').set('Cookie', tampered);
    expect(response.status).toBe(401);
  });

  it('rechaza /refresh y /me si el usuario ya no existe', async () => {
    const user = await registerUser(app);
    await User.deleteOne({ _id: user.userId });

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', user.refreshTokenCookie);
    expect(refresh.status).toBe(401);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(me.status).toBe(404);
  });

  it('logout sin cookie o con un token basura responde 204 igualmente', async () => {
    const withoutCookie = await request(app).post('/api/auth/logout');
    expect(withoutCookie.status).toBe(204);
    const withGarbage = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'refreshToken=basura');
    expect(withGarbage.status).toBe(204);
  });
});

describe('POST /api/auth/password', () => {
  it('cambia la contraseña, cierra las demás sesiones y mantiene la actual', async () => {
    const user = await registerUser(app, { password: 'password123' });
    // Otra sesión del mismo usuario (otro dispositivo).
    const otherLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'password123' });
    const otherCookie = String(otherLogin.headers['set-cookie']?.[0]);

    const response = await request(app)
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Cookie', user.refreshTokenCookie)
      .send({ currentPassword: 'password123', newPassword: 'nueva-clave-segura' });

    expect(response.status).toBe(200);
    expect(typeof response.body.accessToken).toBe('string');
    const newCookie = String(response.headers['set-cookie']?.[0]);
    expect(newCookie).toMatch(/refreshToken=.+HttpOnly/i);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'password123' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'nueva-clave-segura' });
    expect(newLogin.status).toBe(200);

    // Las sesiones anteriores quedan revocadas; la nueva funciona.
    for (const cookie of [user.refreshTokenCookie, otherCookie]) {
      const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
      expect(refresh.status).toBe(401);
    }
    const refreshNew = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
    expect(refreshNew.status).toBe(200);
  });

  it('rechaza una contraseña actual incorrecta con 400 (no 401) y no cambia nada', async () => {
    const user = await registerUser(app, { password: 'password123' });

    const response = await request(app)
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ currentPassword: 'incorrecta', newPassword: 'nueva-clave-segura' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('La contraseña actual no es correcta');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'password123' });
    expect(login.status).toBe(200);
    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', user.refreshTokenCookie);
    expect(refresh.status).toBe(200);
  });

  it('valida la contraseña nueva: mínimo 10 caracteres y distinta de la actual', async () => {
    const user = await registerUser(app, { password: 'password123' });

    for (const newPassword of ['corta', 'password123']) {
      const response = await request(app)
        .post('/api/auth/password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ currentPassword: 'password123', newPassword });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('exige estar autenticado', async () => {
    const response = await request(app)
      .post('/api/auth/password')
      .send({ currentPassword: 'password123', newPassword: 'nueva-clave-segura' });
    expect(response.status).toBe(401);
  });
});
