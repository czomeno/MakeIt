import { z } from 'zod';
import { isValidObjectId } from 'mongoose';

export const objectId = z
  .string()
  .refine((value) => isValidObjectId(value), { message: 'Id inválido' });

export const boardIdParams = z.object({ id: objectId });
export const columnIdParams = z.object({ id: objectId });
export const cardIdParams = z.object({ id: objectId });
export const boardScopedColumnParams = z.object({ boardId: objectId });
export const columnScopedCardParams = z.object({ columnId: objectId });
export const invitationIdParams = z.object({ id: objectId });
export const boardScopedMemberParams = z.object({ boardId: objectId, userId: objectId });
