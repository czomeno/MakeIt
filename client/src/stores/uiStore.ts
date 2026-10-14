import { create } from 'zustand';

// Estado de UI compartido entre el sidebar (botón "+ Nuevo tablero") y la
// página de tableros (estado vacío): ambos abren el mismo modal global.
interface UiState {
  isCreateBoardOpen: boolean;
  openCreateBoard: () => void;
  closeCreateBoard: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCreateBoardOpen: false,
  openCreateBoard: () => set({ isCreateBoardOpen: true }),
  closeCreateBoard: () => set({ isCreateBoardOpen: false }),
}));
