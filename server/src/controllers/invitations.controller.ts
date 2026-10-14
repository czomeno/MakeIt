import type { RequestHandler } from 'express';
import * as invitationsService from '../services/invitations.service.js';
import { requireBoardContext, requireUser, stringParam } from '../utils/requestContext.js';

export const createInvitation: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const result = await invitationsService.create(boardId, req.body, actor.id);
  res.status(201).json(result);
};

export const listInvitations: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const invitations = await invitationsService.listPending(boardId);
  res.status(200).json({ invitations });
};

export const revokeInvitation: RequestHandler = async (req, res) => {
  await invitationsService.revoke(stringParam(req, 'id'));
  res.status(204).send();
};

export const acceptInvitation: RequestHandler = async (req, res) => {
  const actor = requireUser(req);
  const result = await invitationsService.accept(req.body.token, actor.id, actor.email);
  res.status(200).json(result);
};
