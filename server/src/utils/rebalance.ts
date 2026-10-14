export const POSITION_GAP = 1000;

// Si el hueco entre dos vecinos baja de esto, el siguiente punto medio
// corre riesgo de quedar indistinguible de alguno de los dos en float64.
export const REBALANCE_THRESHOLD = 1;

export function needsRebalance(prev?: number, next?: number): boolean {
  return prev !== undefined && next !== undefined && next - prev < REBALANCE_THRESHOLD;
}

// ids: todos los hermanos en orden actual, SIN el que se mueve.
// insertAt: índice (0-based) donde debe quedar el elemento movido dentro de
// esa lista. Devuelve la posición nueva de TODOS, uniformemente espaciados.
export function rebalancedPositions(
  ids: string[],
  insertAt: number,
  movedId: string,
): Map<string, number> {
  const ordered = [...ids];
  const index = Math.max(0, Math.min(insertAt, ordered.length));
  ordered.splice(index, 0, movedId);

  const positions = new Map<string, number>();
  ordered.forEach((id, i) => positions.set(id, (i + 1) * POSITION_GAP));
  return positions;
}
