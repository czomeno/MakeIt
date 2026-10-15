import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BoardView = 'list' | 'board';

interface ViewPreferenceState {
  boardView: BoardView;
  setBoardView: (view: BoardView) => void;
  // Submenú "Mis tableros" de la barra lateral, desplegado o no.
  isBoardsMenuOpen: boolean;
  toggleBoardsMenu: () => void;
}

// Preferencias de la interfaz que se recuerdan en este navegador:
// - Vista con la que se abre un tablero: la lista por defecto; si el usuario
//   elige el tablero (arrastrar y soltar), se recuerda.
// - Si el submenú de tableros de la barra lateral está abierto.
export const useViewPreferenceStore = create<ViewPreferenceState>()(
  persist(
    (set) => ({
      boardView: 'list',
      setBoardView: (boardView) => set({ boardView }),
      isBoardsMenuOpen: true,
      toggleBoardsMenu: () => set((state) => ({ isBoardsMenuOpen: !state.isBoardsMenuOpen })),
    }),
    { name: 'makeit-board-view' },
  ),
);
