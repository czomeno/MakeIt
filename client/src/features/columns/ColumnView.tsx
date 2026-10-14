import {
  forwardRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { ColumnWithCards } from '../../types/api';
import { useCreateCardMutation } from '../cards/hooks';
import { useUpdateColumnMutation, useDeleteColumnMutation } from './hooks';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/Button';
import { ApiError } from '../../api/client';
import { toastError } from '../../stores/toastStore';

interface ColumnViewProps {
  boardId: string;
  column: ColumnWithCards;
  canEdit: boolean;
  // Las tarjetas se renderizan fuera (SortableColumn las envuelve en su
  // SortableContext); esta es la lista ya montada, lista para insertar.
  cardsSlot: ReactNode;
  style?: CSSProperties;
  isDragging?: boolean;
  // Atributos + listeners de dnd-kit para el asa de arrastre de la columna.
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

export const ColumnView = forwardRef<HTMLDivElement, ColumnViewProps>(function ColumnView(
  { boardId, column, canEdit, cardsSlot, style, isDragging = false, dragHandleProps },
  ref,
) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');

  const updateColumn = useUpdateColumnMutation(boardId);
  const deleteColumn = useDeleteColumnMutation(boardId);
  const createCard = useCreateCardMutation(boardId);

  function startEditing() {
    setTitleDraft(column.title);
    setIsEditingTitle(true);
  }

  function commitTitle() {
    const trimmed = titleDraft.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === column.title) {
      return;
    }
    updateColumn.mutate(
      { id: column._id, input: { title: trimmed } },
      {
        onError: (error: unknown) => {
          toastError(
            error instanceof ApiError ? error.message : 'No se pudo renombrar la columna.',
          );
        },
      },
    );
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setTitleDraft(column.title);
      setIsEditingTitle(false);
    }
  }

  function handleAddCard(event: FormEvent) {
    event.preventDefault();
    const title = newCardTitle.trim();
    if (!title) {
      return;
    }
    createCard.mutate(
      { columnId: column._id, input: { title } },
      {
        onSuccess: () => setNewCardTitle(''),
        onError: (error: unknown) => {
          toastError(error instanceof ApiError ? error.message : 'No se pudo crear la tarjeta.');
        },
      },
    );
  }

  return (
    <div
      ref={ref}
      style={style}
      className={`flex w-full flex-col rounded-xl border border-border bg-surface ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        {isEditingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleTitleKeyDown}
            aria-label="Título de la columna"
            className="min-w-0 flex-1 rounded border border-accent bg-transparent px-1 py-0.5 text-sm font-medium text-text focus-visible:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => canEdit && startEditing()}
            disabled={!canEdit}
            className={`min-w-0 flex-1 truncate text-left text-sm font-medium text-text disabled:cursor-default ${
              canEdit ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            {...(canEdit ? dragHandleProps : undefined)}
          >
            {column.title}
          </button>
        )}
        <span className="shrink-0 text-xs text-text-muted">{column.cards.length}</span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            aria-label={`Borrar columna ${column.title}`}
            className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-danger"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex min-h-20 flex-row gap-2 overflow-x-auto px-3 py-3">{cardsSlot}</div>

      {canEdit && (
        <form onSubmit={handleAddCard} className="flex max-w-xs gap-2 border-t border-border p-2">
          <input
            value={newCardTitle}
            onChange={(event) => setNewCardTitle(event.target.value)}
            placeholder="Añadir tarjeta..."
            aria-label={`Añadir tarjeta a ${column.title}`}
            className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
          <Button
            type="submit"
            variant="secondary"
            isLoading={createCard.isPending}
            className="px-2.5 py-1.5 text-xs"
          >
            Añadir
          </Button>
        </form>
      )}

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Borrar columna"
        description={
          column.cards.length > 0
            ? `Se perderán "${column.title}" y ${column.cards.length === 1 ? 'su 1 tarjeta' : `sus ${column.cards.length} tarjetas`}.`
            : `Se borrará la columna "${column.title}".`
        }
        confirmLabel="Borrar columna"
        isDangerous
        isLoading={deleteColumn.isPending}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() =>
          deleteColumn.mutate(column._id, {
            onSuccess: () => setIsDeleteOpen(false),
            onError: (error: unknown) => {
              toastError(
                error instanceof ApiError ? error.message : 'No se pudo borrar la columna.',
              );
            },
          })
        }
      />
    </div>
  );
});
