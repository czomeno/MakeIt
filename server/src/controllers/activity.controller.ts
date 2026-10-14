import type { RequestHandler } from 'express';
import * as activityService from '../services/activity.service.js';
import type { ActivityQuery } from '../schemas/activity.schema.js';
import { requireBoardContext, stringParam } from '../utils/requestContext.js';

// validate() ya parseó/coaccionó req.query con activityQuerySchema antes de
// llegar aquí (ver middleware/validate.ts); el tipo de Express para
// req.query es genérico (ParsedQs), de ahí el cast.
export const listBoardActivity: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const page = await activityService.listForBoard(boardId, req.query as ActivityQuery);
  res.status(200).json(page);
};

export const listCardActivity: RequestHandler = async (req, res) => {
  const page = await activityService.listForCard(
    stringParam(req, 'id'),
    req.query as ActivityQuery,
  );
  res.status(200).json(page);
};
