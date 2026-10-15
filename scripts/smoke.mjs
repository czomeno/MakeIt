#!/usr/bin/env node
// Smoke test post-despliegue: comprueba que una instancia de MakeIt (local o
// en producción) está viva y que el flujo básico funciona de punta a punta.
//
//   npm run smoke -- https://makeit.onrender.com
//   npm run smoke -- http://localhost:8080 --env-file .env.smoke.local
//
// Usa una cuenta FIJA (SMOKE_EMAIL / SMOKE_PASSWORD): la registra la primera
// vez y después solo inicia sesión, así no acumula usuarios en la base de
// datos. El tablero que crea se borra siempre, aunque algo falle.
import process from 'node:process';

const args = process.argv.slice(2);
const envFileIndex = args.indexOf('--env-file');
if (envFileIndex !== -1) {
  process.loadEnvFile(args[envFileIndex + 1]);
  args.splice(envFileIndex, 2);
}

const baseUrl = (args[0] ?? process.env.SMOKE_URL ?? '').replace(/\/+$/, '');
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!baseUrl || !email || !password) {
  console.error(
    'Uso: npm run smoke -- <url> [--env-file <archivo>]\n' +
      'Necesita SMOKE_EMAIL y SMOKE_PASSWORD (mín. 10 caracteres) en el entorno o en el archivo.',
  );
  process.exit(2);
}

const isHttps = baseUrl.startsWith('https://');
let failures = 0;

function ok(message) {
  console.log(`  ✔ ${message}`);
}
function fail(message) {
  failures += 1;
  console.error(`  ✖ ${message}`);
}
function check(condition, message, detail = '') {
  if (condition) ok(message);
  else fail(detail ? `${message} (${detail})` : message);
  return condition;
}

async function call(path, { method = 'GET', token, cookie, body } = {}) {
  const headers = { Accept: 'application/json, text/html' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
    // Margen para el arranque en frío del plan gratuito de Render.
    signal: AbortSignal.timeout(90_000),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, headers: response.headers, text, json };
}

function refreshCookieFrom(response) {
  const raw = response.headers.getSetCookie().find((c) => c.startsWith('refreshToken='));
  return raw ? { raw, pair: raw.split(';')[0] } : undefined;
}

async function main() {
  console.log(`Smoke test contra ${baseUrl}\n`);

  console.log('Salud');
  const health = await call('/api/health');
  check(health.status === 200 && health.json?.status === 'ok', 'GET /api/health responde ok');
  check(
    health.json?.db === 'connected',
    'la base de datos está conectada',
    `db=${health.json?.db}`,
  );
  console.log(`    versión: ${health.json?.version ?? '?'}`);
  const ready = await call('/api/ready');
  check(ready.status === 200, 'GET /api/ready responde 200', `status=${ready.status}`);

  console.log('Frontend');
  const home = await call('/');
  check(home.status === 200 && home.text.includes('<div id="root">'), 'GET / sirve la app');
  const deep = await call('/boards/ruta-profunda-de-prueba');
  check(
    deep.status === 200 && deep.text.includes('<div id="root">'),
    'una ruta profunda del router sirve index.html',
  );
  const missingApi = await call('/api/ruta-que-no-existe');
  check(
    missingApi.status === 404 && missingApi.json?.error?.code === 'NOT_FOUND',
    '/api inexistente devuelve 404 JSON (no index.html)',
  );

  console.log('Cabeceras de seguridad');
  for (const header of [
    'content-security-policy',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
    ...(isHttps ? ['strict-transport-security'] : []),
  ]) {
    check(home.headers.has(header), header);
  }

  console.log('Autenticación');
  let auth = await call('/api/auth/login', { method: 'POST', body: { email, password } });
  if (auth.status === 401) {
    auth = await call('/api/auth/register', {
      method: 'POST',
      body: { name: 'Smoke test', email, password },
    });
    check(
      auth.status === 201,
      'registro de la cuenta del smoke test (primera vez)',
      `status=${auth.status}`,
    );
  } else {
    check(auth.status === 200, 'login con la cuenta del smoke test', `status=${auth.status}`);
  }
  let token = auth.json?.accessToken;
  const cookie = refreshCookieFrom(auth);
  if (!token || !cookie) {
    fail('no se obtuvo sesión: no se puede seguir');
    return;
  }
  check(/HttpOnly/i.test(cookie.raw), 'cookie de refresh httpOnly');
  check(/SameSite=Strict/i.test(cookie.raw), 'cookie de refresh SameSite=Strict');
  check(/Path=\/api\/auth/i.test(cookie.raw), 'cookie de refresh con path /api/auth');
  if (isHttps) check(/Secure/i.test(cookie.raw), 'cookie de refresh Secure');

  const refreshed = await call('/api/auth/refresh', { method: 'POST', cookie: cookie.pair });
  check(refreshed.status === 200 && refreshed.json?.accessToken, 'refresh con la cookie');
  const rotated = refreshCookieFrom(refreshed);
  token = refreshed.json?.accessToken ?? token;
  const me = await call('/api/auth/me', { token });
  check(me.status === 200 && me.json?.user?.email === email.toLowerCase(), 'GET /api/auth/me');

  console.log('Tableros');
  const title = `smoke-${new Date().toISOString()}`;
  const created = await call('/api/boards', {
    method: 'POST',
    token,
    body: { title, template: 'generic' },
  });
  const boardId = created.json?.board?._id;
  check(created.status === 201 && boardId, 'crear un tablero');
  try {
    if (boardId) {
      const detail = await call(`/api/boards/${boardId}`, { token });
      check(
        detail.status === 200 && detail.json?.board?.columns?.length === 3,
        'leer el tablero con sus columnas',
      );
    }
  } finally {
    if (boardId) {
      const removed = await call(`/api/boards/${boardId}`, { method: 'DELETE', token });
      check(removed.status === 204, 'borrar el tablero (sin dejar basura)');
    }
  }

  const logout = await call('/api/auth/logout', {
    method: 'POST',
    cookie: (rotated ?? cookie).pair,
  });
  check(logout.status === 204, 'cerrar sesión');
}

try {
  await main();
} catch (error) {
  fail(`error inesperado: ${error.message}`);
}

console.log(failures === 0 ? '\nSmoke test OK' : `\nSmoke test con ${failures} fallo(s)`);
process.exit(failures === 0 ? 0 : 1);
