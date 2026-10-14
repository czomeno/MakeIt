import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBoardQuery, useDeleteBoardMutation } from './hooks';
import { useAuthStore } from '../../stores/authStore';
import { ApiError } from '../../api/client';
import { toastError, toastSuccess } from '../../stores/toastStore';
import { BoardHeader } from './BoardHeader';
import { BoardNotFound } from './BoardNotFound';
import { BoardPageSkeleton } from './BoardPageSkeleton';
import { EditBoardModal } from './EditBoardModal';
import { Board } from '../board/Board';
import { BoardListView } from '../board/BoardListView';
import { BoardAccessLost } from '../board/BoardAccessLost';
import { useBoardSocket, type ActiveDrag } from '../board/useBoardSocket';
import { CardDetailModal } from '../cards/CardDetailModal';
import { CollaborationModal } from '../members/CollaborationModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';

export function BoardPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const query = useBoardQuery(id);
  const userId = useAuthStore((state) => state.user?.id);
  const deleteMutation = useDeleteBoardMutation(id);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // Solo el id: la tarjeta se deriva del board (abajo) para que el modal
  // siempre vea los datos frescos tras guardar o mover, no una foto fija.
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [isCollaborationOpen, setIsCollaborationOpen] = useState(false);
  const activeDragRef = useRef<ActiveDrag>(null);

  const { connectionStatus, presence, accessLost } = useBoardSocket(id, {
    activeDragRef,
    activeCardId,
    onActiveCardRemoved: () => setActiveCardId(null),
  });

  if (query.isPending) {
    return <BoardPageSkeleton />;
  }

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <BoardNotFound />;
    }
    return (
      <EmptyState
        title="No se pudo cargar el tablero"
        description={query.error instanceof ApiError ? query.error.message : 'Inténtalo de nuevo.'}
        action={
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  const board = query.data;

  if (accessLost) {
    return <BoardAccessLost reason={accessLost} />;
  }

  const myRole = board.members.find((member) => member.user === userId)?.role;
  const canEdit = myRole === 'editor' || myRole === 'admin';
  const isAdmin = myRole === 'admin';
  const activeCard =
    board.columns.flatMap((column) => column.cards).find((c) => c._id === activeCardId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <BoardHeader
        board={board}
        isAdmin={isAdmin}
        onEdit={() => setIsEditOpen(true)}
        onDelete={() => setIsDeleteOpen(true)}
        onOpenCollaboration={() => setIsCollaborationOpen(true)}
        connectionStatus={connectionStatus}
        presence={presence}
      />

      <CollaborationModal
        boardId={board._id}
        ownerId={board.owner}
        isAdmin={isAdmin}
        isOpen={isCollaborationOpen}
        onClose={() => setIsCollaborationOpen(false)}
      />

      <div
        role="radiogroup"
        aria-label="Vista del tablero"
        className="inline-flex self-start rounded-lg border border-border bg-surface p-0.5 text-sm"
      >
        <button
          type="button"
          role="radio"
          aria-checked={viewMode === 'board'}
          onClick={() => setViewMode('board')}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            viewMode === 'board' ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
          }`}
        >
          Tablero
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={viewMode === 'list'}
          onClick={() => setViewMode('list')}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            viewMode === 'list' ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
          }`}
        >
          Lista
        </button>
      </div>

      {viewMode === 'board' ? (
        <Board
          board={board}
          canEdit={canEdit}
          onOpenCard={(card) => setActiveCardId(card._id)}
          activeDragRef={activeDragRef}
        />
      ) : (
        <BoardListView
          board={board}
          canEdit={canEdit}
          onOpenCard={(card) => setActiveCardId(card._id)}
        />
      )}

      {isAdmin && (
        <>
          <EditBoardModal board={board} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} />
          <ConfirmDialog
            isOpen={isDeleteOpen}
            title="Borrar tablero"
            description={`Se borrará "${board.title}" junto con ${board.columns.length === 1 ? 'su 1 columna' : `sus ${board.columns.length} columnas`} y todas sus tarjetas. Esta acción no se puede deshacer.`}
            confirmLabel="Borrar tablero"
            isDangerous
            isLoading={deleteMutation.isPending}
            onCancel={() => setIsDeleteOpen(false)}
            onConfirm={() =>
              deleteMutation.mutate(undefined, {
                onSuccess: () => {
                  toastSuccess('Tablero borrado.');
                  navigate('/boards', { replace: true });
                },
                onError: (error: unknown) => {
                  toastError(
                    error instanceof ApiError ? error.message : 'No se pudo borrar el tablero.',
                  );
                },
              })
            }
          />
        </>
      )}

      {activeCard && (
        <CardDetailModal
          boardId={board._id}
          template={board.template}
          card={activeCard}
          canEdit={canEdit}
          isOpen={true}
          onClose={() => setActiveCardId(null)}
        />
      )}
    </div>
  );
}
