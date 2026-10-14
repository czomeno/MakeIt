import type { RequestHandler } from 'express';
import * as membersService from '../services/members.service.js';
import { requireBoardContext, requireUser, stringParam } from '../utils/requestContext.js';
import { AppError } from '../errors/AppError.js';

export const listMembers: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const members = await membersService.list(boardId);
  res.status(200).json({ members });
};

export const updateMemberRole: RequestHandler = async (req, res) => {
  const { boardId } = requireBoardContext(req);
  const actor = requireUser(req);
  const member = await membersService.updateRole(
    boardId,
    stringParam(req, 'userId'),
    req.body.role,
    actor.id,
  );
  res.status(200).json({ member });
};

// Un admin puede expulsar a cualquiera; cualquier otro miembro solo puede
// borrarse a sí mismo ("abandonar tablero").
export const removeMember: RequestHandler = async (req, res) => {
  const { boardId, role } = requireBoardContext(req);
  const actor = requireUser(req);
  const targetUserId = stringParam(req, 'userId');

  if (targetUserId !== actor.id && role !== 'admin') {
    throw AppError.forbidden('Solo un admin puede expulsar a otros miembros');
  }

  await membersService.remove(boardId, targetUserId, actor.id);
  res.status(204).send();
};
