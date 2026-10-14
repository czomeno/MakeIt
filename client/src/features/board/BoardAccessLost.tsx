import { Link } from 'react-router-dom';
import type { AccessLostReason } from './useBoardSocket';

const MESSAGES: Record<NonNullable<AccessLostReason>, { title: string; description: string }> = {
  removed: {
    title: 'Ya no tienes acceso a este tablero',
    description: 'Un administrador te ha quitado del tablero.',
  },
  deleted: {
    title: 'Este tablero ha sido borrado',
    description: 'Ya no está disponible para nadie.',
  },
};

interface BoardAccessLostProps {
  reason: NonNullable<AccessLostReason>;
}

// Reemplaza por completo la vista del tablero (no un modal encima): seguir
// mostrando columnas/tarjetas de un tablero al que ya no tienes acceso
// invitaría a seguir interactuando con algo que la API va a rechazar.
export function BoardAccessLost({ reason }: BoardAccessLostProps) {
  const { title, description } = MESSAGES[reason];
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <p className="text-lg font-medium text-text">{title}</p>
      <p className="text-sm text-text-muted">{description}</p>
      <Link
        to="/boards"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Ir a mis tableros
      </Link>
    </div>
  );
}
