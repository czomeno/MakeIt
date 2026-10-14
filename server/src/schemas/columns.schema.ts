import { z } from 'zod';
import { objectId } from './common.js';

export const createColumnSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120),
});

export const updateColumnSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export const moveColumnSchema = z
  .object({
    prevColumnId: objectId.optional(),
    nextColumnId: objectId.optional(),
  })
  .refine((data) => data.prevColumnId !== undefined || data.nextColumnId !== undefined, {
    message: 'Indica al menos una columna vecina',
  });

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
