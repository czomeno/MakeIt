import type { ColumnWithCards } from '../../types/api';

interface ColumnOverlayProps {
  column: ColumnWithCards;
}

// Copia visual simplificada de la columna (sin volver a montar todas sus
// tarjetas, por rendimiento) mientras se arrastra.
export function ColumnOverlay({ column }: ColumnOverlayProps) {
  return (
    <div className="w-72 shrink-0 cursor-grabbing rounded-xl border border-accent bg-surface shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
          {column.title}
        </span>
        <span className="shrink-0 text-xs text-text-muted">{column.cards.length}</span>
      </div>
      <div className="px-3 py-4 text-xs text-text-muted">
        {column.cards.length === 0
          ? 'Sin tarjetas'
          : `${column.cards.length} tarjeta${column.cards.length === 1 ? '' : 's'}`}
      </div>
    </div>
  );
}
