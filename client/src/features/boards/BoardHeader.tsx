import type { Board } from '../../types/api';
import { Button } from '../../components/Button';
import type { ConnectionStatus } from '../board/useBoardSocket';

const TEMPLATE_LABELS: Record<Board['template'], string> = {
  generic: 'Genérico',
  'job-applications': 'Candidaturas de empleo',
};

// Con la conexión en marcha no se muestra nada: solo se avisa cuando se ha
// caído, para que nadie siga editando sin saber que no le llegan los cambios.
const CONNECTION_PROBLEMS: Partial<Record<ConnectionStatus, { label: string; dot: string }>> = {
  reconnecting: { label: 'Reconectando…', dot: 'bg-amber-500 animate-pulse' },
  offline: { label: 'Sin conexión', dot: 'bg-danger' },
};

interface BoardHeaderProps {
  board: Board;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenCollaboration: () => void;
  connectionStatus: ConnectionStatus;
}

export function BoardHeader({
  board,
  isAdmin,
  onEdit,
  onDelete,
  onOpenCollaboration,
  connectionStatus,
}: BoardHeaderProps) {
  const connectionProblem = CONNECTION_PROBLEMS[connectionStatus];

  return (
    // data-connection-status: los e2e esperan a "connected" antes de colaborar.
    <div
      className="flex flex-col gap-3 border-b border-border pb-4"
      data-connection-status={connectionStatus}
    >
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

      {connectionProblem && (
        <span role="status" className="flex items-center gap-1.5 text-xs text-text-muted">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${connectionProblem.dot}`} />
          {connectionProblem.label}
        </span>
      )}
    </div>
  );
}
