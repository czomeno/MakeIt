import type { Request } from 'express';
import type { AuthUser } from '../types/auth.js';
import type { BoardRole } from '../models/Board.js';
import { AppError } from '../errors/AppError.js';

// requireAuth garantiza req.user; este guard evita repetir el chequeo y el "!".
export function requireUser(req: Request): AuthUser {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user;
}

// requireBoardRole garantiza req.boardId/req.boardRole.
export function requireBoardContext(req: Request): { boardId: string; role: BoardRole } {
  if (!req.boardId || !req.boardRole) {
    throw AppError.unauthorized();
  }
  return { boardId: req.boardId, role: req.boardRole };
}

// req.params tipa cada valor como string | string[] | undefined; ya validado
// como ObjectId por el middleware validate() antes de llegar al controller.
export function stringParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw AppError.badRequest(`Falta el parámetro "${name}"`);
  }
  return value;
}
