import { useMemo, useState } from 'react';
import type { BoardWithContent, Card, CardPriority, ColumnWithCards } from '../../types/api';
import { useMoveCardMutation, useToggleCardCompletedMutation } from '../cards/hooks';
import { cardNoun } from '../../lib/cardNoun';
import { cardMoveApiInput, type CardMoveParams } from './boardReducers';
import { avatarColorFor, categoryButtonClasses, pillClassesFor } from '../../lib/badgeColors';
import { EmptyState } from '../../components/EmptyState';
import { Dropdown } from '../../components/Dropdown';
import { Button } from '../../components/Button';
import { PRIORITY_LABELS, PRIORITY_OPTIONS, priorityClassesFor } from '../../lib/priority';
import { addDaysKey, dueDay, formatDueDate, todayKey } from '../../lib/dueDate';

type PriorityFilter = 'all' | CardPriority | 'none';
type DateFilter = 'all' | 'overdue' | 'today' | 'week' | 'none';

// Casilla de "hecha": cambia en el mismo clic (estado local) y se sincroniza
// con la tarjeta cuando llega el valor de la caché (optimista o del servidor,
// o el anterior si falla y se deshace).
function CompletedCheckbox({
  title,
  completed,
  disabled,
  onToggle,
}: {
  title: string;
  completed: boolean;
  disabled: boolean;
  onToggle: (completed: boolean) => void;
}) {
  const [checked, setChecked] = useState(completed);
  const [synced, setSynced] = useState(completed);
  if (completed !== synced) {
    setSynced(completed);
    setChecked(completed);
  }
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => {
        setChecked(event.target.checked);
        onToggle(event.target.checked);
      }}
      aria-label={`Marcar «${title}» como hecha`}
      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-border accent-accent disabled:cursor-default"
    />
  );
}

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  all: 'Cualquiera',
  overdue: 'Vencidas',
  today: 'Para hoy',
  week: 'Próximos 7 días',
  none: 'Sin fecha',
};

function matchesSearch(card: Card, term: string): boolean {
  if (!term) {
    return true;
  }
  return [card.title, card.company, card.description, ...card.labels].some((text) =>
    text?.toLowerCase().includes(term),
  );
}

function matchesPriority(card: Card, filter: PriorityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return !card.priority;
  return card.priority === filter;
}

function matchesDate(card: Card, filter: DateFilter, today: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return !card.dueDate;
  if (!card.dueDate) return false;
  const day = dueDay(card.dueDate);
  if (filter === 'overdue') return day < today && !card.completed;
  if (filter === 'today') return day === today;
  return day >= today && day <= addDaysKey(today, 7);
}

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
  const toggleCompletedMutation = useToggleCardCompletedMutation(board._id);

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const allRows = useMemo(
    () => board.columns.flatMap((column) => column.cards.map((card) => ({ card, column }))),
    [board.columns],
  );
  const term = search.trim().toLowerCase();
  const today = todayKey();
  const rows = allRows.filter(
    ({ card, column }) =>
      matchesSearch(card, term) &&
      matchesPriority(card, priorityFilter) &&
      (statusFilter === 'all' || column._id === statusFilter) &&
      matchesDate(card, dateFilter, today),
  );
  const isFiltering =
    term !== '' || priorityFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setPriorityFilter('all');
    setStatusFilter('all');
    setDateFilter('all');
  }

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

  return (
    <div className="flex flex-col gap-3">
      {canEdit && board.columns.length === 0 && (
        <EmptyState
          title="Este tablero todavía no tiene categorías"
          description="Crea al menos una categoría desde la vista de tablero antes de añadir tareas."
        />
      )}

      {allRows.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 sm:flex-1">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
            >
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="m13.5 13.5 3 3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar"
              aria-label="Buscar tareas"
              className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Dropdown
              variant="filter"
              placeholder="Prioridad"
              ariaLabel="Filtrar por prioridad"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: 'all', label: 'Todas' },
                ...PRIORITY_OPTIONS,
                { value: 'none', label: 'Sin prioridad' },
              ]}
            />
            <Dropdown
              variant="filter"
              placeholder="Estado"
              ariaLabel="Filtrar por estado"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos' },
                ...board.columns.map((column) => ({ value: column._id, label: column.title })),
              ]}
            />
            <Dropdown
              variant="filter"
              placeholder="Fecha"
              ariaLabel="Filtrar por fecha"
              value={dateFilter}
              onChange={setDateFilter}
              options={(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((value) => ({
                value,
                label: DATE_FILTER_LABELS[value],
              }))}
            />
            {isFiltering && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-accent hover:underline"
              >
                Quitar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {allRows.length === 0 ? (
        !canEdit || board.columns.length > 0 ? (
          <EmptyState
            title="No hay tarjetas todavía"
            description={
              canEdit
                ? `Añade la primera con «Añadir ${cardNoun(board.template)}».`
                : 'Este tablero todavía no tiene tarjetas.'
            }
          />
        ) : null
      ) : rows.length === 0 ? (
        <EmptyState
          title="Ninguna tarea coincide"
          description="Prueba con otra búsqueda o quita algún filtro."
          action={
            <Button type="button" variant="secondary" onClick={clearFilters}>
              Quitar filtros
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Tareas">
          {rows.map(({ card, column }) => (
            <li
              key={card._id}
              className={`flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm transition-colors hover:border-accent/60 sm:flex-row sm:items-center sm:gap-4 sm:px-4 ${
                card.completed ? 'opacity-70' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <CompletedCheckbox
                  title={card.title}
                  completed={card.completed ?? false}
                  disabled={!canEdit}
                  onToggle={(completed) =>
                    toggleCompletedMutation.mutate({ id: card._id, completed })
                  }
                />
                <button
                  type="button"
                  onClick={() => onOpenCard(card)}
                  className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                >
                  <span
                    className={`font-medium ${card.completed ? 'text-text-muted line-through' : 'text-text'}`}
                  >
                    {card.title}
                  </span>
                  {card.company && (
                    <span className="flex items-center gap-2 text-sm text-text-muted">
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${avatarColorFor(card.company)}`}
                      >
                        {card.company.charAt(0).toUpperCase()}
                      </span>
                      {card.company}
                    </span>
                  )}
                  {card.labels.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1.5">
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
              </div>

              <div className="flex flex-wrap items-center gap-2 pl-8 sm:shrink-0 sm:justify-end sm:pl-0">
                {card.priority && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${priorityClassesFor(card.priority)}`}
                  >
                    {PRIORITY_LABELS[card.priority]}
                  </span>
                )}
                <div
                  className="flex flex-wrap gap-1.5"
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
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity disabled:cursor-default ${categoryButtonClasses(targetColumn.title, isActive)}`}
                      >
                        {targetColumn.title}
                      </button>
                    );
                  })}
                </div>
                {card.dueDate && (
                  <span className="text-sm whitespace-nowrap text-text-muted">
                    {formatDueDate(card.dueDate)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
