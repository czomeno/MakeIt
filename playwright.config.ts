import { defineConfig, devices } from '@playwright/test';

// Suite e2e pequeña y fiable contra el stack REAL (imágenes de producción,
// nginx + API + Mongo efímero) de docker-compose.e2e.yml. Ver e2e/README.md.
//
// - En local, global-setup levanta el stack y global-teardown lo tira.
// - Si E2E_BASE_URL está definida (el CI levanta el stack en un paso aparte
//   para poder volcar sus logs si algo falla), no se gestiona Docker.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 8081}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Sin reintentos: un test que solo pasa a la segunda es un test inestable,
  // y debe arreglarse, no esconderse.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    // Trazas, capturas y vídeo solo cuando un test falla.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'es-ES',
    // El service worker de la PWA cachearía el esqueleto entre tests: se
    // bloquea para que cada test vea siempre lo que sirve el servidor.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Escritorio Full HD: el tablero de los tests cabe sin scroll. Si la
        // página tiene que desplazarse, el KeyboardSensor de dnd-kit mueve la
        // tarjeta con un scroll suave cuya duración no controlamos.
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
