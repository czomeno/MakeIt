/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En Docker la API vive en el servicio "api"; en local, en :4000.
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      exclude: ['src/test/**', 'src/main.tsx', '**/*.d.ts', '**/*.config.*'],
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
