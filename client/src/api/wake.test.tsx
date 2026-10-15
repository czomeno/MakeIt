import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { deferred } from '../test/deferred';
import { apiRequest, rawRequest, wakeConfig, ApiError } from './client';
import { bootstrapSession } from './auth';
import { useAuthStore } from '../stores/authStore';
import { useConnectivityStore } from '../stores/connectivityStore';
import { ServerWakeBanner } from '../components/ServerWakeBanner';
import { TEST_USER } from '../test/handlers';

// Tiempos cortos para no esperar segundos reales en los tests.
const original = { ...wakeConfig };
beforeEach(() => {
  Object.assign(wakeConfig, { slowAfterMs: 30, maxWaitMs: 2000, retryDelaysMs: [10] });
  useConnectivityStore.setState({ slowRequests: 0 });
});
afterEach(() => {
  Object.assign(wakeConfig, original);
});

describe('arranque en frío del servidor', () => {
  it('si una petición tarda, muestra el aviso y lo quita al responder', async () => {
    const response = deferred();
    server.use(
      http.get('/api/lento', async () => {
        await response.promise;
        return HttpResponse.json({ ok: true });
      }),
    );
    render(<ServerWakeBanner />);

    const pending = rawRequest('/lento');
    expect(
      await screen.findByText('Despertando el servidor, puede tardar hasta un minuto…'),
    ).toBeInTheDocument();

    response.resolve();
    await expect(pending).resolves.toEqual({ ok: true });
    await waitFor(() =>
      expect(screen.queryByText(/Despertando el servidor/)).not.toBeInTheDocument(),
    );
  });

  it('reintenta 502/503/504 del proxy hasta que el servidor responde', async () => {
    let calls = 0;
    server.use(
      http.get('/api/despertando', () => {
        calls += 1;
        return calls < 3
          ? new HttpResponse('Service Unavailable', { status: calls === 1 ? 502 : 503 })
          : HttpResponse.json({ ok: true });
      }),
    );
    await expect(rawRequest('/despertando')).resolves.toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it('un error de red en una mutación NO se reintenta (podría duplicarla)', async () => {
    let calls = 0;
    server.use(
      http.post('/api/crear', () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );
    await expect(rawRequest('/crear', { method: 'POST', body: {} })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it('los errores normales de la API no se reintentan', async () => {
    let calls = 0;
    server.use(
      http.get('/api/prohibido', () => {
        calls += 1;
        return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'No' } }, { status: 403 });
      }),
    );
    await expect(apiRequest('/prohibido')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(1);
  });

  it('regresión: un 503 durante el arranque NO cierra la sesión al cargar la app', async () => {
    let refreshCalls = 0;
    server.use(
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1;
        return refreshCalls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ accessToken: 'token-tras-despertar' });
      }),
      http.get('/api/auth/me', () => HttpResponse.json({ user: TEST_USER })),
    );
    useAuthStore.setState({ status: 'loading', user: null, accessToken: null });

    await bootstrapSession();

    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'token-tras-despertar',
    });
  });
});
