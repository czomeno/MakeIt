import { useAuthStore } from '../stores/authStore';
import { TAB_ID } from '../socket/clientId';
import type { ApiErrorBody } from '../types/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value;
}

// Petición "cruda", sin reintento por 401. La usan login/register/refresh/
// logout: un 401 ahí es el resultado real (credenciales inválidas, refresh
// caducado...), no un access token expirado a reintentar.
export async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const method = options.method ?? 'GET';
  if (method !== 'GET') {
    // Permite que esta pestaña ignore el eco de su propia mutación cuando
    // vuelva por el socket (ver client/src/socket/clientId.ts).
    headers['X-Mutation-Id'] = TAB_ID;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include', // cookie httpOnly del refresh token
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const body = isApiErrorBody(data) ? data : undefined;
    throw new ApiError(
      response.status,
      body?.error.code ?? 'UNKNOWN_ERROR',
      body?.error.message ?? 'Ha ocurrido un error inesperado',
      body?.error.details,
    );
  }

  return data as T;
}

let refreshPromise: Promise<string> | null = null;

// Varias peticiones en paralelo con un access token caducado comparten esta
// misma promesa: solo se dispara una llamada real a /auth/refresh.
function refreshAccessToken(): Promise<string> {
  refreshPromise ??= rawRequest<{ accessToken: string }>('/auth/refresh', { method: 'POST' })
    .then((data) => {
      useAuthStore.getState().setAccessToken(data.accessToken);
      return data.accessToken;
    })
    .catch((error: unknown) => {
      useAuthStore.getState().clearSession();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// Petición autenticada normal: si el access token ha caducado (401), hace
// un único refresh y reintenta la petición una sola vez.
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await refreshAccessToken();
      return rawRequest<T>(path, options);
    }
    throw error;
  }
}
