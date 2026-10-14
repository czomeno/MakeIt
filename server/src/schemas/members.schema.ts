import { z } from 'zod';
import { BOARD_ROLES } from '../models/Board.js';

export const updateMemberRoleSchema = z.object({ role: z.enum(BOARD_ROLES) });

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
