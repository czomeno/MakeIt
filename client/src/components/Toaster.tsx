import { useToastStore } from '../stores/toastStore';

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-lg bg-surface text-text ${
            toast.variant === 'success'
              ? 'border-success/40'
              : toast.variant === 'error'
                ? 'border-danger/40'
                : 'border-accent/40'
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Cerrar notificación"
            className="text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
