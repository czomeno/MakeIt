import type { CardPriority } from '../types/api';

export const PRIORITY_OPTIONS: { value: CardPriority; label: string }[] = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

export const PRIORITY_LABELS: Record<CardPriority, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

// Mismos colores de pill que las etiquetas (claro y oscuro ya definidos en
// index.css): rojo, ámbar y gris como en el resto de la interfaz.
const PRIORITY_CLASSES: Record<CardPriority, string> = {
  high: 'bg-pill-red text-pill-red-ink',
  medium: 'bg-pill-amber text-pill-amber-ink',
  low: 'bg-pill-gray text-pill-gray-ink',
};

export function priorityClassesFor(priority: CardPriority): string {
  return PRIORITY_CLASSES[priority];
}
