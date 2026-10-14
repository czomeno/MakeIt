import { Link } from 'react-router-dom';
import type { Board, BoardRole } from '../../types/api';
import { useAuthStore } from '../../stores/authStore';

const TEMPLATE_LABELS: Record<Board['template'], string> = {
  generic: 'Genérico',
  'job-applications': 'Candidaturas de empleo',
};

const ROLE_LABELS: Record<BoardRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Lector',
};

// Rol fijo con 3 valores posibles: un color semántico por rol, no por hash.
const ROLE_PILL_CLASSES: Record<BoardRole, string> = {
  admin: 'bg-pill-purple text-pill-purple-ink',
  editor: 'bg-pill-blue text-pill-blue-ink',
  viewer: 'bg-pill-gray text-pill-gray-ink',
};

interface BoardCardProps {
  board: Board;
}

export function BoardCard({ board }: BoardCardProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const myRole = board.members.find((member) => member.user === userId)?.role;

  return (
    <Link
      to={`/boards/${board._id}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-text">{board.title}</h3>
        {myRole && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_PILL_CLASSES[myRole]}`}
          >
            {ROLE_LABELS[myRole]}
          </span>
        )}
      </div>
      {board.description && (
        <p className="line-clamp-2 text-sm text-text-muted">{board.description}</p>
      )}
      <span className="mt-auto w-fit rounded-full bg-pill-gray px-2 py-0.5 text-xs font-medium text-pill-gray-ink">
        {TEMPLATE_LABELS[board.template]}
      </span>
    </Link>
  );
}
