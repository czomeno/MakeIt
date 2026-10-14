import { useState, type FormEvent } from 'react';
import type { BoardWithContent, Card, ColumnWithCards } from '../../types/api';
import { useCreateCardMutation, useMoveCardMutation } from '../cards/hooks';
import { cardMoveApiInput, type CardMoveParams } from './boardReducers';
import { avatarColorFor, categoryButtonClasses, pillClassesFor } from '../../lib/badgeColors';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { ApiError } from '../../api/client';
import { toastError } from '../../stores/toastStore';

interface BoardListViewProps {
  board: BoardWithContent;
  canEdit: boolean;
  onOpenCard: (card: Card) => void;
}

// Misma información que el tablero, pero en una lista plana: cada tarjeta es
// una fila con un botón por columna a la derecha. Pulsar un botón mueve la
// tarjeta a esa columna (al final) reutilizando el mismo mutation/optimismo
// que el arrastre; no hay gesto de arrastre que seguir aquí.
export function BoardListView({ board, canEdit, onOpenCard }: BoardListViewProps) {
  const moveCardMutation = useMoveCardMutation(board._id);
  const createCardMutation = useCreateCardMutation(board._id);
  const [newTitle, setNewTitle] = useState('');
  const [targetColumnId, setTargetColumnId] = useState(board.columns[0]?._id ?? '');

  const rows = board.columns.flatMap((column) => column.cards.map((card) => ({ card, column })));

  function handleMoveTo(card: Card, sourceColumn: ColumnWithCards, targetColumn: ColumnWithCards) {
    if (targetColumn._id === sourceColumn._id) {
      return;
    }
    const params: CardMoveParams = {
      cardId: card._id,
      sourceColumnId: sourceColumn._id,
      targetColumnId: targetColumn._id,
      targetIndex: targetColumn.cards.length,
    };
    moveCardMutation.mutate({
      cardId: card._id,
      apiInput: cardMoveApiInput(board, params),
      cardMove: params,
    });
  }

  function handleAddCard(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    // Por si la columna elegida se borró mientras el formulario estaba abierto.
    const columnId = board.columns.some((column) => column._id === targetColumnId)
      ? targetColumnId
      : board.columns[0]?._id;
    if (!title || !columnId) {
      return;
    }
    createCardMutation.mutate(
      { columnId, input: { title } },
      {
        onSuccess: () => setNewTitle(''),
        onError: (error: unknown) => {
          toastError(error instanceof ApiError ? error.message : 'No se pudo crear la tarjeta.');
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit &&
        (board.columns.length > 0 ? (
          <form
            onSubmit={handleAddCard}
            className="flex w-full flex-col gap-2 rounded-xl border border-dashed border-border p-3 sm:flex-row sm:items-center"
          >
            <label
              htmlFor="list-add-card-title"
              className="shrink-0 text-sm font-medium text-text-muted"
            >
              Nueva tarea o solicitud
            </label>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              <input
                id="list-add-card-title"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Título..."
                className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
              />
              <select
                value={targetColumnId}
                onChange={(event) => setTargetColumnId(event.target.value)}
                aria-label="Categoría inicial"
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-2 focus-visible:outline-accent"
              >
                {board.columns.map((column) => (
                  <option key={column._id} value={column._id}>
                    {column.title}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                variant="secondary"
                isLoading={createCardMutation.isPending}
                className="px-2.5 py-1.5 text-xs"
              >
                Añadir
              </Button>
            </div>
          </form>
        ) : (
          <EmptyState
            title="Este tablero todavía no tiene categorías"
            description="Crea al menos una categoría desde la vista de tablero antes de añadir tareas."
          />
        ))}

      {rows.length === 0 ? (
        !canEdit || board.columns.length > 0 ? (
          <EmptyState
            title="No hay tarjetas todavía"
            description={
              canEdit
                ? 'Añade la primera desde el formulario de arriba.'
                : 'Este tablero todavía no tiene tarjetas.'
            }
          />
        ) : null
      ) : (
        rows.map(({ card, column }) => (
          <div
            key={card._id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <button
              type="button"
              onClick={() => onOpenCard(card)}
              className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="font-medium text-text">{card.title}</span>
                {card.dueDate && (
                  <span className="shrink-0 text-xs text-text-muted">
                    {new Date(card.dueDate).toLocaleDateString('es-ES')}
                  </span>
                )}
              </span>
              {(card.company || card.labels.length > 0) && (
                <span className="flex flex-wrap items-center gap-1.5">
                  {card.company && (
                    <span className="flex items-center gap-1.5 text-xs text-text-muted">
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white ${avatarColorFor(card.company)}`}
                      >
                        {card.company.charAt(0).toUpperCase()}
                      </span>
                      {card.company}
                    </span>
                  )}
                  {card.labels.map((label) => (
                    <span
                      key={label}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pillClassesFor(label)}`}
                    >
                      {label}
                    </span>
                  ))}
                </span>
              )}
            </button>

            <div
              className="flex shrink-0 flex-wrap gap-1.5"
              role="group"
              aria-label={`Categoría de "${card.title}"`}
            >
              {board.columns.map((targetColumn) => {
                const isActive = targetColumn._id === column._id;
                return (
                  <button
                    key={targetColumn._id}
                    type="button"
                    disabled={!canEdit || isActive}
                    aria-pressed={isActive}
                    onClick={() => handleMoveTo(card, column, targetColumn)}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-opacity disabled:cursor-default ${categoryButtonClasses(targetColumn.title, isActive)}`}
                  >
                    {targetColumn.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
