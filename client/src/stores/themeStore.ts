import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function applyThemeToDocument(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function prefersDark(): boolean {
  // matchMedia no existe en jsdom (tests) ni en entornos sin navegador.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// El sidebar siempre es oscuro (ver index.css); esto solo cambia el fondo y
// las tarjetas del contenido. Persistido en localStorage; si no hay
// preferencia guardada, arranca según el tema del sistema operativo.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: prefersDark() ? 'dark' : 'light',
      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme });
      },
      toggleTheme: () => {
        get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
      },
    }),
    {
      name: 'makeit-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDocument(state.theme);
        }
      },
    },
  ),
);

// Aplica el tema inicial de inmediato (antes de que React monte), por si la
// hidratación del persist tarda un tick y se ve un parpadeo del tema por defecto.
if (typeof document !== 'undefined') {
  applyThemeToDocument(useThemeStore.getState().theme);
}
