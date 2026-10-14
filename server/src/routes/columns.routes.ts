import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireBoardRole } from '../middleware/requireBoardRole.js';
import { fromColumnParam } from '../middleware/boardResolvers.js';
import { validate } from '../middleware/validate.js';
import { columnIdParams, columnScopedCardParams } from '../schemas/common.js';
import { updateColumnSchema, moveColumnSchema } from '../schemas/columns.schema.js';
import { createCardSchema } from '../schemas/cards.schema.js';
import * as columnsController from '../controllers/columns.controller.js';
import * as cardsController from '../controllers/cards.controller.js';

const router = Router();

router.use(requireAuth);

router.patch(
  '/:id',
  validate({ params: columnIdParams, body: updateColumnSchema }),
  requireBoardRole('editor', fromColumnParam('id')),
  columnsController.updateColumn,
);

router.delete(
  '/:id',
  validate({ params: columnIdParams }),
  requireBoardRole('editor', fromColumnParam('id')),
  columnsController.deleteColumn,
);

router.patch(
  '/:id/move',
  validate({ params: columnIdParams, body: moveColumnSchema }),
  requireBoardRole('editor', fromColumnParam('id')),
  columnsController.moveColumn,
);

router.post(
  '/:columnId/cards',
  validate({ params: columnScopedCardParams, body: createCardSchema }),
  requireBoardRole('editor', fromColumnParam('columnId')),
  cardsController.createCard,
);

export default router;
