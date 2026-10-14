import { create } from 'zustand';
import type { User } from '../types/api';

// El access token vive solo aquí, en memoria: nunca en localStorage ni
// sessionStorage. Si se recarga la página, se recupera con /auth/refresh
// (ver api/auth.ts#bootstrapSession). El refresh token no pasa por JS: lo
// gestiona el navegador como cookie httpOnly.
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => {
    set({ status: 'authenticated', user, accessToken });
  },
  setAccessToken: (accessToken) => {
    set({ accessToken });
  },
  clearSession: () => {
    set({ status: 'unauthenticated', user: null, accessToken: null });
  },
}));
