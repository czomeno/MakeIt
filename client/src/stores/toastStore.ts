import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, variant: ToastVariant) => void;
  dismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 4000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, variant) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

export function toastSuccess(message: string): void {
  useToastStore.getState().push(message, 'success');
}

export function toastError(message: string): void {
  useToastStore.getState().push(message, 'error');
}

// Avisos discretos de eventos de otros (p. ej. "Ana ha eliminado la tarjeta
// que tenías abierta"): ni éxito ni error, solo información.
export function toastInfo(message: string): void {
  useToastStore.getState().push(message, 'info');
}
