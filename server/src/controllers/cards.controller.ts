import type { RequestHandler } from 'express';
import * as cardsService from '../services/cards.service.js';
import { requireBoardContext, requireUser, stringParam } from '../utils/requestContext.js';

export const createCard: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const card = await cardsService.create(
    boardId,
    stringParam(req, 'columnId'),
    req.body,
    actor.id,
    req.mutationId,
  );
  res.status(201).json({ card });
};

export const updateCard: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const card = await cardsService.update(
    boardId,
    stringParam(req, 'id'),
    req.body,
    actor.id,
    req.mutationId,
  );
  res.status(200).json({ card });
};

export const deleteCard: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  await cardsService.remove(boardId, stringParam(req, 'id'), actor.id, req.mutationId);
  res.status(204).send();
};

export const moveCard: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const card = await cardsService.move(
    boardId,
    stringParam(req, 'id'),
    req.body,
    actor.id,
    req.mutationId,
  );
  res.status(200).json({ card });
};
