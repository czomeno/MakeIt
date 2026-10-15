import { create } from 'zustand';

// Peticiones que están tardando más de lo normal (p. ej. el servidor del plan
// gratuito de Render "despertando" tras un rato sin tráfico). Mientras haya
// alguna, la app muestra un aviso en vez de parecer colgada o dar un error.
interface ConnectivityState {
  slowRequests: number;
  beginSlowRequest: () => void;
  endSlowRequest: () => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  slowRequests: 0,
  beginSlowRequest: () => set((state) => ({ slowRequests: state.slowRequests + 1 })),
  endSlowRequest: () => set((state) => ({ slowRequests: Math.max(0, state.slowRequests - 1) })),
}));

export const selectIsWaking = (state: ConnectivityState) => state.slowRequests > 0;
