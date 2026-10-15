import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';

// Hay un despliegue nuevo y el service worker ya lo ha descargado: se avisa en
// vez de recargar por sorpresa (podría haber una tarjeta a medio editar).
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="update-prompt-text"
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-100 flex justify-center px-4"
    >
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-surface px-4 py-2.5 text-sm text-text shadow-lg">
        <span id="update-prompt-text">Hay una versión nueva de MakeIt.</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setNeedRefresh(false)}
            className="px-2.5 py-1 text-xs"
          >
            Más tarde
          </Button>
          <Button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="px-2.5 py-1 text-xs"
          >
            Recargar
          </Button>
        </div>
      </div>
    </div>
  );
}
