import type { BoardTemplate } from '../types/api';

// "tarea" o "candidatura" según la plantilla del tablero.
export function cardNoun(template: BoardTemplate): string {
  return template === 'job-applications' ? 'candidatura' : 'tarea';
}
