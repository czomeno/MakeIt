import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('manejo de errores global', () => {
  it('una ruta desconocida devuelve 404 con formato de error estándar', async () => {
    const response = await request(app).get('/api/no-existe');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('un JSON mal formado devuelve 400, no 500', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('un cuerpo demasiado grande devuelve 413', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'x'.repeat(200_000) }));
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('aplica cabeceras de seguridad de helmet', async () => {
    const response = await request(app).get('/api/no-existe');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
