import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

// Singleton: una sola conexión para toda la app, compartida entre cualquier
// tablero que se visite (useBoardSocket se une/sale de rooms, no crea
// conexiones nuevas). No se conecta sola (autoConnect: false): el primer
// useBoardSocket que se monta la abre.
export const socket = io({
  path: '/socket.io',
  autoConnect: false,
  // Función, no objeto fijo: se reevalúa en cada intento de conexión, así
  // que una reconexión tras renovar el access token (refresh) ya manda el
  // token nuevo sin ninguna lógica extra aquí.
  auth: (callback) => callback({ token: useAuthStore.getState().accessToken }),
});

// Si se cierra la sesión, no tiene sentido mantener la conexión ni la
// room abierta con el token antiguo.
useAuthStore.subscribe((state, prevState) => {
  if (state.status === 'unauthenticated' && prevState.status !== 'unauthenticated') {
    socket.disconnect();
  }
});
