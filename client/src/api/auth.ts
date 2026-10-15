import { z } from 'zod';
import { rawRequest, apiRequest } from './client';
import { useAuthStore } from '../stores/authStore';

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
});

const sessionSchema = z.object({ user: userSchema, accessToken: z.string() });
const refreshSchema = z.object({ accessToken: z.string() });
const meSchema = z.object({ user: userSchema });

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// El servidor cierra todas las sesiones y devuelve una nueva para este
// dispositivo (cookie de refresh nueva + access token).
export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const data = refreshSchema.parse(
    await apiRequest('/auth/password', { method: 'POST', body: input }),
  );
  useAuthStore.getState().setAccessToken(data.accessToken);
}

export async function register(input: RegisterInput) {
  const data = sessionSchema.parse(
    await rawRequest('/auth/register', { method: 'POST', body: input }),
  );
  useAuthStore.getState().setSession(data.user, data.accessToken);
  return data.user;
}

export async function login(input: LoginInput) {
  const data = sessionSchema.parse(
    await rawRequest('/auth/login', { method: 'POST', body: input }),
  );
  useAuthStore.getState().setSession(data.user, data.accessToken);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await rawRequest('/auth/logout', { method: 'POST' });
  } finally {
    useAuthStore.getState().clearSession();
  }
}

// Se llama una vez al cargar la app: intenta recuperar la sesión con la
// cookie httpOnly del refresh token. Nunca lanza; deja el store en
// 'authenticated' o 'unauthenticated' para que la UI reaccione.
export async function bootstrapSession(): Promise<void> {
  try {
    const refreshData = refreshSchema.parse(await rawRequest('/auth/refresh', { method: 'POST' }));
    useAuthStore.getState().setAccessToken(refreshData.accessToken);

    const meData = meSchema.parse(await apiRequest('/auth/me'));
    useAuthStore.getState().setSession(meData.user, refreshData.accessToken);
  } catch {
    useAuthStore.getState().clearSession();
  }
}
