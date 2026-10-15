import { create } from 'zustand';
import type { PresenceUser } from '../features/board/useBoardSocket';

// Personas conectadas al tablero abierto. La página del tablero lo rellena
// (y lo vacía al salir) y la cabecera de la app lo muestra arriba a la
// derecha, bajo el interruptor de tema.
interface PresenceState {
  presence: PresenceUser[];
  setPresence: (presence: PresenceUser[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  presence: [],
  setPresence: (presence) => set({ presence }),
}));
