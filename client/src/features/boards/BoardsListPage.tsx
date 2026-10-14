import { useMemo, useState } from 'react';
import { useBoardsQuery } from './hooks';
import { BoardCard } from './BoardCard';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { greetingNow } from '../../lib/greeting';

export function BoardsListPage() {
  const [search, setSearch] = useState('');
  const query = useBoardsQuery();
  const userName = useAuthStore((state) => state.user?.name);
  const openCreateBoard = useUiStore((state) => state.openCreateBoard);

  const filteredBoards = useMemo(() => {
    const boards = query.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return boards;
    }
    return boards.filter((board) => board.title.toLowerCase().includes(term));
  }, [query.data, search]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          {greetingNow()}
          {userName ? `, ${userName.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-text-muted">Esto es lo que tienes en marcha.</p>
      </div>

      {query.isSuccess && query.data.length > 0 && (
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar un tablero..."
          aria-label="Buscar un tablero"
          className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent sm:w-80"
        />
      )}

      {query.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
      )}

      {query.isError && (
        <EmptyState
          title="No se pudieron cargar tus tableros"
          description={
            query.error instanceof ApiError ? query.error.message : 'Inténtalo de nuevo.'
          }
          action={
            <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          }
        />
      )}

      {query.isSuccess && query.data.length === 0 && (
        <EmptyState
          title="Todavía no tienes tableros"
          description="Crea tu primer tablero para empezar a organizar tareas o candidaturas."
          action={
            <Button type="button" onClick={openCreateBoard}>
              Crear mi primer tablero
            </Button>
          }
        />
      )}

      {query.isSuccess && query.data.length > 0 && filteredBoards.length === 0 && (
        <EmptyState title="Ningún tablero coincide con esa búsqueda" />
      )}

      {filteredBoards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBoards.map((board) => (
            <BoardCard key={board._id} board={board} />
          ))}
        </div>
      )}
    </div>
  );
}
