import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { apiRequest } from './client';
import { useAuthStore } from '../stores/authStore';
import { deferred } from '../test/deferred';

describe('apiRequest — refresh ante un 401', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 'expired-token' });
  });

  it('hace un refresh y reintenta la petición original una sola vez', async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get('/api/protected', () => {
        protectedCalls += 1;
        if (protectedCalls === 1) {
          return HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Token caducado' } },
            { status: 401 },
          );
        }
        return HttpResponse.json({ ok: true });
      }),
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: 'fresh-token' });
      }),
    );

    const result = await apiRequest<{ ok: boolean }>('/protected');

    expect(result).toEqual({ ok: true });
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });

  it('varias peticiones en paralelo con 401 comparten un único refresh', async () => {
    let refreshCalls = 0;
    let unauthorizedCalls = 0;
    const refreshResponse = deferred();

    server.use(
      http.get('/api/protected', ({ request }) => {
        if (request.headers.get('Authorization') === 'Bearer fresh-token') {
          return HttpResponse.json({ ok: true });
        }
        unauthorizedCalls += 1;
        return HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Token caducado' } },
          { status: 401 },
        );
      }),
      http.post('/api/auth/refresh', async () => {
        refreshCalls += 1;
        await refreshResponse.promise;
        return HttpResponse.json({ accessToken: 'fresh-token' });
      }),
    );

    const pending = Promise.all([
      apiRequest('/protected'),
      apiRequest('/protected'),
      apiRequest('/protected'),
    ]);
    // El refresh no responde hasta que las tres peticiones han recibido su
    // 401: así se garantiza que coinciden en el tiempo.
    await vi.waitFor(() => expect(unauthorizedCalls).toBe(3));
    refreshResponse.resolve();
    const results = await pending;

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
  });

  it('si el refresh falla, limpia la sesión y propaga el error', async () => {
    server.use(
      http.get('/api/protected', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Token caducado' } },
          { status: 401 },
        ),
      ),
      http.post('/api/auth/refresh', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Refresh inválido' } },
          { status: 401 },
        ),
      ),
    );

    await expect(apiRequest('/protected')).rejects.toThrow();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});
