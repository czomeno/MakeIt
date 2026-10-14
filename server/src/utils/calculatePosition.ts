const GAP = 1000;

// Posición numérica entre dos vecinos; evita reescribir el resto de la lista
// al reordenar. Sin vecinos, arranca en GAP; con uno solo, se aleja de él.
export function calculatePosition(prev?: number, next?: number): number {
  if (prev !== undefined && next !== undefined) {
    return (prev + next) / 2;
  }
  if (prev !== undefined) {
    return prev + GAP;
  }
  if (next !== undefined) {
    return next / 2;
  }
  return GAP;
}
