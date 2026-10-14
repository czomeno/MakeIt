import type { RequestHandler } from 'express';
import * as columnsService from '../services/columns.service.js';
import { requireBoardContext, requireUser, stringParam } from '../utils/requestContext.js';

export const createColumn: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const column = await columnsService.create(boardId, req.body, actor.id, req.mutationId);
  res.status(201).json({ column });
};

export const updateColumn: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const column = await columnsService.update(
    boardId,
    stringParam(req, 'id'),
    req.body,
    actor.id,
    req.mutationId,
  );
  res.status(200).json({ column });
};

export const deleteColumn: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  await columnsService.remove(boardId, stringParam(req, 'id'), actor.id, req.mutationId);
  res.status(204).send();
};

export const moveColumn: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const column = await columnsService.move(
    boardId,
    stringParam(req, 'id'),
    req.body,
    actor.id,
    req.mutationId,
  );
  res.status(200).json({ column });
};
