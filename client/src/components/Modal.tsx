import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo accesible hecho a mano (en vez de <dialog>/showModal): atrapa el
// foco con Tab, cierra con Escape y devuelve el foco a quien lo abrió.
export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Id único por instancia: con dos modales apilados (p. ej. detalle de
  // tarjeta + confirmación de borrado) un id fijo se duplicaría y el lector
  // de pantalla anunciaría el diálogo con el título equivocado.
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? container)?.focus();

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // A nivel de documento, no solo onKeyDown del contenedor: tras una
    // mutación que vuelve a renderizar el contenido, el foco puede acabar
    // fuera del modal (p. ej. tras un page.select() o un re-render del
    // <select>), y entonces Escape dejaría de burbujear hasta el contenedor.
    // Con modales apilados solo cierra el de encima: cada portal se añade al
    // final de <body>, así que el último diálogo modal es el más reciente.
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] === containerRef.current) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface text-text shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
