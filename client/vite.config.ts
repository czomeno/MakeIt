/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// En Docker la API vive en el servicio "api"; en local, en :4000.
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA instalable. El service worker SOLO precachea los estáticos de la app
    // (el "esqueleto"): nunca respuestas de /api ni el tráfico de Socket.io,
    // que siempre van a la red (datos en vivo y por usuario).
    VitePWA({
      // La versión nueva no se activa sola: UpdatePrompt pregunta antes de
      // recargar, para no perder lo que se esté editando.
      registerType: 'prompt',
      injectRegister: false,
      // Los iconos ya entran por globPatterns; así no se precachean dos veces.
      includeManifestIcons: false,
      manifest: {
        name: 'MakeIt',
        short_name: 'MakeIt',
        description: 'Tableros Kanban colaborativos en tiempo real',
        lang: 'es',
        dir: 'ltr',
        start_url: '/boards',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#3b66e0',
        background_color: '#eef1f6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Navegación a cualquier ruta del router -> index.html precacheado...
        navigateFallback: '/index.html',
        // ...salvo la API y el socket, que nunca pasan por el service worker.
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        // Sin runtimeCaching: nada que no sea el esqueleto se cachea.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // jsdom no tiene service worker: el registro de la PWA se sustituye por un doble.
    alias: { 'virtual:pwa-register/react': '/src/test/pwaRegisterMock.ts' },
    css: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', '**/*.d.ts', '**/*.config.*', '**/*.test.*'],
      reporter: ['text-summary', 'lcov', 'json-summary'],
      // Umbral mínimo: por debajo, `npm run test:coverage` (y el CI) fallan.
      // El arrastre con ratón/teclado de dnd-kit no se puede ejercitar en
      // jsdom; esa parte la cubren los tests e2e de Playwright.
      thresholds: { lines: 72, statements: 72, functions: 72, branches: 60 },
    },
  },
  server: {
    host: true, // accesible desde fuera del contenedor
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true, // necesario para hot reload con el código montado como volumen
    },
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiUrl,
        changeOrigin: true,
        ws: true, // necesario para el upgrade de WebSocket del socket
      },
    },
  },
});
