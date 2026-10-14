import type { RequestHandler } from 'express';
import * as boardsService from '../services/boards.service.js';
import { requireUser, requireBoardContext } from '../utils/requestContext.js';

export const listBoards: RequestHandler = async (req, res) => {
  const user = requireUser(req);
  const boards = await boardsService.listForUser(user.id);
  res.status(200).json({ boards });
};

export const createBoard: RequestHandler = async (req, res) => {
  const user = requireUser(req);
  const board = await boardsService.create(user.id, req.body);
  res.status(201).json({ board });
};

export const getBoard: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const board = await boardsService.getWithContent(boardId);
  res.status(200).json({ board });
};

export const updateBoard: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const board = await boardsService.update(boardId, req.body, actor.id, req.mutationId);
  res.status(200).json({ board });
};

export const deleteBoard: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  await boardsService.remove(boardId, actor.id);
  res.status(204).send();
};
