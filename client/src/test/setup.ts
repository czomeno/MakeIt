import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';
import { fakeSocket } from './socketMock';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { useConnectivityStore } from '../stores/connectivityStore';

// jsdom no puede abrir sockets reales (y no debería intentarlo en tests):
// cualquier `io(...)` de socket.io-client, en cualquier archivo, recibe este
// doble en su lugar. useBoardSocket.test.tsx lo pilota con trigger()/sent.
vi.mock('socket.io-client', () => ({ io: () => fakeSocket }));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  cleanup();
  fakeSocket.reset();
  // Zustand es un singleton de módulo: se resetea a mano entre tests.
  useAuthStore.setState({ status: 'unauthenticated', user: null, accessToken: null });
  useUiStore.setState({ isCreateBoardOpen: false });
  useToastStore.setState({ toasts: [] });
  useConnectivityStore.setState({ slowRequests: 0 });
});

afterAll(() => server.close());
