import type { Request, RequestHandler } from 'express';
import { Board, type BoardRole } from '../models/Board.js';
import { AppError } from '../errors/AppError.js';

const ROLE_RANK: Record<BoardRole, number> = { viewer: 1, editor: 2, admin: 3 };

type BoardIdResolver = (req: Request) => Promise<string | null> | string | null;

// No-miembro -> 404 (no revela que el tablero existe).
// Miembro con rol insuficiente -> 403 (ya sabe que existe).
export function requireBoardRole(
  minRole: BoardRole,
  resolveBoardId: BoardIdResolver,
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        next(AppError.unauthorized());
        return;
      }

      const boardId = await resolveBoardId(req);
      if (!boardId) {
        next(AppError.notFound('Tablero no encontrado'));
        return;
      }

      const board = await Board.findById(boardId).select('members').lean();
      if (!board) {
        next(AppError.notFound('Tablero no encontrado'));
        return;
      }

      const membership = board.members.find((member) => member.user.toString() === authUser.id);
      if (!membership) {
        next(AppError.notFound('Tablero no encontrado'));
        return;
      }

      if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
        next(AppError.forbidden('No tienes permisos suficientes sobre este tablero'));
        return;
      }

      req.boardId = boardId;
      req.boardRole = membership.role;
      next();
    } catch (error) {
      next(error);
    }
  };
}
