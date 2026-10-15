import { z } from 'zod';
import { objectId } from './common.js';
import { CARD_PRIORITIES } from '../models/Card.js';

const cardFields = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200),
  description: z.string().trim().max(5000).optional(),
  labels: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  dueDate: z.coerce.date().optional(),
  assignees: z.array(objectId).max(20).optional(),
  // null quita la prioridad (al editar); sin el campo, no se toca.
  priority: z.enum(CARD_PRIORITIES).nullable().optional(),
  completed: z.boolean().optional(),
  // Candidaturas de empleo (template "job-applications").
  company: z.string().trim().max(120).optional(),
  jobUrl: z.string().trim().url('URL inválida').max(500).optional(),
});

export const createCardSchema = cardFields;

export const updateCardSchema = cardFields
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No hay campos para actualizar' });

export const moveCardSchema = z.object({
  columnId: objectId,
  prevCardId: objectId.optional(),
  nextCardId: objectId.optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
