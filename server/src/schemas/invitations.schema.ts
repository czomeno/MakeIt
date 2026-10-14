import { z } from 'zod';
import { BOARD_ROLES } from '../models/Board.js';

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  role: z.enum(BOARD_ROLES),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Falta el token'),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
