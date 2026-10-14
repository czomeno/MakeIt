import type { Board } from '../../types/api';
import { Button } from '../../components/Button';
import { avatarColorFor } from '../../lib/badgeColors';
import type { ConnectionStatus, PresenceUser } from '../board/useBoardSocket';

const TEMPLATE_LABELS: Record<Board['template'], string> = {
  generic: 'Genérico',
  'job-applications': 'Candidaturas de empleo',
};

const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Conectando…',
  connected: 'En vivo',
  reconnecting: 'Reconectando…',
  offline: 'Sin conexión',
};

const CONNECTION_DOT: Record<ConnectionStatus, string> = {
  connecting: 'bg-text-muted',
  connected: 'bg-success',
  reconnecting: 'bg-amber-500',
  offline: 'bg-danger',
};

interface BoardHeaderProps {
  board: Board;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenCollaboration: () => void;
  connectionStatus: ConnectionStatus;
  presence: PresenceUser[];
}

export function BoardHeader({
  board,
  isAdmin,
  onEdit,
  onDelete,
  onOpenCollaboration,
  connectionStatus,
  presence,
}: BoardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{board.title}</h1>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
              {TEMPLATE_LABELS[board.template]}
            </span>
          </div>
          {board.description && (
            <p className="mt-1 max-w-2xl text-sm text-text-muted">{board.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" onClick={onOpenCollaboration}>
            Colaboración
          </Button>
          {isAdmin && (
            <>
              <Button type="button" variant="secondary" onClick={onEdit}>
                Editar
              </Button>
              <Button type="button" variant="danger" onClick={onDelete}>
                Borrar tablero
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${CONNECTION_DOT[connectionStatus]} ${
              connectionStatus === 'reconnecting' ? 'animate-pulse' : ''
            }`}
          />
          {CONNECTION_LABELS[connectionStatus]}
        </span>

        {presence.length > 0 && (
          <div
            className="flex items-center -space-x-2"
            role="group"
            aria-label="Personas conectadas a este tablero"
          >
            {presence.map((user) => (
              <span
                key={user.userId}
                title={user.name}
                aria-hidden="true"
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg text-[10px] font-bold text-white ${avatarColorFor(user.name || user.userId)}`}
              >
                {user.initials || '?'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
