import { Router } from 'express';
import { getHealth, getReady } from '../controllers/health.controller.js';

export const healthRouter = Router();
healthRouter.get('/', getHealth);

export const readyRouter = Router();
readyRouter.get('/', getReady);
