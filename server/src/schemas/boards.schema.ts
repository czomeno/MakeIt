import { z } from 'zod';
import { BOARD_TEMPLATES } from '../models/Board.js';

export const createBoardSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120),
  description: z.string().trim().max(2000).optional(),
  template: z.enum(BOARD_TEMPLATES),
});

export const updateBoardSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No hay campos para actualizar' });

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
