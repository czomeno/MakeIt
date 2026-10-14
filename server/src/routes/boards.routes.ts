import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireBoardRole } from '../middleware/requireBoardRole.js';
import { fromParam } from '../middleware/boardResolvers.js';
import { validate } from '../middleware/validate.js';
import {
  boardIdParams,
  boardScopedColumnParams,
  boardScopedMemberParams,
} from '../schemas/common.js';
import { createBoardSchema, updateBoardSchema } from '../schemas/boards.schema.js';
import { createColumnSchema } from '../schemas/columns.schema.js';
import { activityQuerySchema } from '../schemas/activity.schema.js';
import { createInvitationSchema } from '../schemas/invitations.schema.js';
import { updateMemberRoleSchema } from '../schemas/members.schema.js';
import { invitationsLimiter } from './invitations.routes.js';
import * as boardsController from '../controllers/boards.controller.js';
import * as columnsController from '../controllers/columns.controller.js';
import * as activityController from '../controllers/activity.controller.js';
import * as invitationsController from '../controllers/invitations.controller.js';
import * as membersController from '../controllers/members.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', boardsController.listBoards);
router.post('/', validate({ body: createBoardSchema }), boardsController.createBoard);

router.get(
  '/:id',
  validate({ params: boardIdParams }),
  requireBoardRole('viewer', fromParam('id')),
  boardsController.getBoard,
);

router.patch(
  '/:id',
  validate({ params: boardIdParams, body: updateBoardSchema }),
  requireBoardRole('admin', fromParam('id')),
  boardsController.updateBoard,
);

router.delete(
  '/:id',
  validate({ params: boardIdParams }),
  requireBoardRole('admin', fromParam('id')),
  boardsController.deleteBoard,
);

router.post(
  '/:boardId/columns',
  validate({ params: boardScopedColumnParams, body: createColumnSchema }),
  requireBoardRole('editor', fromParam('boardId')),
  columnsController.createColumn,
);

router.get(
  '/:boardId/activity',
  validate({ params: boardScopedColumnParams, query: activityQuerySchema }),
  requireBoardRole('viewer', fromParam('boardId')),
  activityController.listBoardActivity,
);

router.post(
  '/:boardId/invitations',
  invitationsLimiter,
  validate({ params: boardScopedColumnParams, body: createInvitationSchema }),
  requireBoardRole('admin', fromParam('boardId')),
  invitationsController.createInvitation,
);

router.get(
  '/:boardId/invitations',
  validate({ params: boardScopedColumnParams }),
  requireBoardRole('admin', fromParam('boardId')),
  invitationsController.listInvitations,
);

router.get(
  '/:boardId/members',
  validate({ params: boardScopedColumnParams }),
  requireBoardRole('viewer', fromParam('boardId')),
  membersController.listMembers,
);

router.patch(
  '/:boardId/members/:userId',
  validate({ params: boardScopedMemberParams, body: updateMemberRoleSchema }),
  requireBoardRole('admin', fromParam('boardId')),
  membersController.updateMemberRole,
);

router.delete(
  '/:boardId/members/:userId',
  validate({ params: boardScopedMemberParams }),
  // 'viewer': cualquier miembro puede llegar aquí para poder abandonar el
  // tablero; expulsar a otro exige admin, comprobado dentro del controller.
  requireBoardRole('viewer', fromParam('boardId')),
  membersController.removeMember,
);

export default router;
