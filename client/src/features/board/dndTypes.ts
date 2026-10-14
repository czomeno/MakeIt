// Datos adjuntos a cada draggable/droppable de dnd-kit (vía `data`), para
// distinguir tarjetas de columnas en la estrategia de colisiones, los
// anuncios y el coordinate getter del teclado.
export interface CardDragData {
  type: 'card';
  columnId: string;
}

export interface ColumnDragData {
  type: 'column';
}

export type DragData = CardDragData | ColumnDragData;

export function isCardData(data: unknown): data is CardDragData {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'card';
}

export function isColumnData(data: unknown): data is ColumnDragData {
  return (
    typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'column'
  );
}
