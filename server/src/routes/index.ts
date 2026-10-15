import { Router } from 'express';
import { healthRouter, readyRouter } from './health.routes.js';
import authRoutes from './auth.routes.js';
import boardsRoutes from './boards.routes.js';
import columnsRoutes from './columns.routes.js';
import cardsRoutes from './cards.routes.js';
import invitationsRoutes from './invitations.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/ready', readyRouter);
router.use('/auth', authRoutes);
router.use('/boards', boardsRoutes);
router.use('/columns', columnsRoutes);
router.use('/cards', cardsRoutes);
router.use('/invitations', invitationsRoutes);

export default router;
