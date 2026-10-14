import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireBoardRole } from '../middleware/requireBoardRole.js';
import { fromCardParam } from '../middleware/boardResolvers.js';
import { validate } from '../middleware/validate.js';
import { cardIdParams } from '../schemas/common.js';
import { updateCardSchema, moveCardSchema } from '../schemas/cards.schema.js';
import { activityQuerySchema } from '../schemas/activity.schema.js';
import * as cardsController from '../controllers/cards.controller.js';
import * as activityController from '../controllers/activity.controller.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/:id/activity',
  validate({ params: cardIdParams, query: activityQuerySchema }),
  requireBoardRole('viewer', fromCardParam('id')),
  activityController.listCardActivity,
);

router.patch(
  '/:id',
  validate({ params: cardIdParams, body: updateCardSchema }),
  requireBoardRole('editor', fromCardParam('id')),
  cardsController.updateCard,
);

router.delete(
  '/:id',
  validate({ params: cardIdParams }),
  requireBoardRole('editor', fromCardParam('id')),
  cardsController.deleteCard,
);

router.patch(
  '/:id/move',
  validate({ params: cardIdParams, body: moveCardSchema }),
  requireBoardRole('editor', fromCardParam('id')),
  cardsController.moveCard,
);

export default router;
