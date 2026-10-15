import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/db.js';
import { registerUser } from './helpers/factories.js';

// `env` es un objeto normal: se ajusta por test para probar el modo
// producción (imagen única) y se restaura al acabar.
const original = { ...env };
afterEach(() => {
  Object.assign(env, original);
});

let dist: string;
beforeAll(async () => {
  await connectTestDB();
  dist = mkdtempSync(path.join(tmpdir(), 'makeit-dist-'));
  mkdirSync(path.join(dist, 'assets'));
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(path.join(dist, 'sw.js'), 'self.skipWaiting()');
  writeFileSync(path.join(dist, 'pwa-192x192.png'), 'png');
});
afterAll(async () => {
  rmSync(dist, { recursive: true, force: true });
  await closeTestDB();
});

function clientApp() {
  Object.assign(env, { SERVE_CLIENT: true, CLIENT_DIST_PATH: dist });
  return createApp();
}

describe('imagen única: la API sirve el frontend', () => {
  it('sirve index.html en / y en rutas profundas del router, sin caché', async () => {
    const app = clientApp();
    for (const route of ['/', '/boards/123', '/invite/abc']) {
      const response = await request(app).get(route);
      expect(response.status).toBe(200);
      expect(response.text).toContain('<div id="root">');
      expect(response.headers['cache-control']).toBe('no-cache');
    }
  });

  it('los assets con hash tienen caché larga e inmutable; sw.js nunca se cachea', async () => {
    const app = clientApp();
    const asset = await request(app).get('/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const sw = await request(app).get('/sw.js');
    expect(sw.headers['cache-control']).toBe('no-cache');
    const icon = await request(app).get('/pwa-192x192.png');
    expect(icon.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('una ruta inexistente de /api es 404 JSON, nunca index.html', async () => {
    const app = clientApp();
    for (const route of ['/api/no-existe', '/api', '/api/inexistente/x/y/z']) {
      const response = await request(app).get(route);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('un archivo estático inexistente es 404, no index.html', async () => {
    const response = await request(clientApp()).get('/assets/no-existe.js');
    expect(response.status).toBe(404);
  });

  it('/api sigue funcionando con el cliente activado', async () => {
    const response = await request(clientApp()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('envía cabeceras de seguridad con una CSP para la SPA', async () => {
    const response = await request(clientApp()).get('/');
    const csp = response.headers['content-security-policy'] as string;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sin SERVE_CLIENT no sirve el frontend (la API va sola)', async () => {
    Object.assign(env, { SERVE_CLIENT: false });
    const response = await request(createApp()).get('/boards/123');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('cookie del refresh token', () => {
  afterEach(clearTestDB);

  it('en producción es httpOnly, Secure, SameSite=Strict, con path restringido y caducidad', async () => {
    Object.assign(env, { NODE_ENV: 'production' });
    const { refreshTokenCookie } = await registerUser(createApp());
    expect(refreshTokenCookie).toMatch(/HttpOnly/);
    expect(refreshTokenCookie).toMatch(/Secure/);
    expect(refreshTokenCookie).toMatch(/SameSite=Strict/);
    expect(refreshTokenCookie).toMatch(/Path=\/api\/auth/);
    const expires = /Expires=([^;]+)/.exec(refreshTokenCookie)?.[1];
    expect(expires).toBeDefined();
    // Persistente (no de sesión): caduca con el JWT, ~30 días.
    const days = (new Date(expires!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
  });

  it('la cookie sigue permitiendo renovar la sesión', async () => {
    const app = createApp();
    const { refreshTokenCookie } = await registerUser(app);
    const cookie = refreshTokenCookie.split(';')[0]!;
    const response = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']?.[0]).toMatch(/Expires=/);
  });
});

describe('CORS', () => {
  it('sin CORS_ORIGIN no se permite ningún origen externo', async () => {
    Object.assign(env, { CORS_ORIGIN: undefined });
    const response = await request(createApp())
      .get('/api/health')
      .set('Origin', 'https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('con CORS_ORIGIN solo se permite ese origen', async () => {
    Object.assign(env, { CORS_ORIGIN: 'https://cliente.example' });
    const response = await request(createApp())
      .get('/api/health')
      .set('Origin', 'https://cliente.example');
    expect(response.headers['access-control-allow-origin']).toBe('https://cliente.example');
  });
});
