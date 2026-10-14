import { useThemeStore } from '../stores/themeStore';

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <div className="inline-flex items-center gap-2 text-sm text-text-muted">
      <span className={isDark ? '' : 'text-text'}>Claro</span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Cambiar entre tema claro y oscuro"
        onClick={toggleTheme}
        className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full border border-border transition-colors ${
          isDark ? 'bg-accent' : 'bg-surface-hover'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            isDark ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={isDark ? 'text-text' : ''}>Oscuro</span>
    </div>
  );
}
