import { selectIsWaking, useConnectivityStore } from '../stores/connectivityStore';
import { Spinner } from './Spinner';

// Aviso amable mientras el servidor "despierta" (arranque en frío del plan
// gratuito): sustituye a lo que de otro modo parecería un cuelgue o un error.
export function ServerWakeBanner() {
  const isWaking = useConnectivityStore(selectIsWaking);
  if (!isWaking) {
    return null;
  }
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-100 flex justify-center px-4"
    >
      <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-surface px-4 py-2.5 text-sm text-text shadow-lg">
        <span aria-hidden="true" className="flex">
          <Spinner size="sm" className="text-accent" />
        </span>
        <span>Despertando el servidor, puede tardar hasta un minuto…</span>
      </div>
    </div>
  );
}
