import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireBoardRole } from '../middleware/requireBoardRole.js';
import { fromInvitationParam } from '../middleware/boardResolvers.js';
import { validate } from '../middleware/validate.js';
import { invitationIdParams } from '../schemas/common.js';
import { acceptInvitationSchema } from '../schemas/invitations.schema.js';
import { env } from '../config/env.js';
import * as invitationsController from '../controllers/invitations.controller.js';

// Cubre tanto crear invitaciones (en boards.routes.ts) como aceptarlas: en
// ambos casos un atacante podría intentar fuerza bruta (probar tokens, o
// invitar en bucle), así que comparten el mismo límite por IP.
export const invitationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

const router = Router();

router.use(requireAuth);
router.use(invitationsLimiter);

router.post(
  '/accept',
  validate({ body: acceptInvitationSchema }),
  invitationsController.acceptInvitation,
);

router.delete(
  '/:id',
  validate({ params: invitationIdParams }),
  requireBoardRole('admin', fromInvitationParam('id')),
  invitationsController.revokeInvitation,
);

export default router;
