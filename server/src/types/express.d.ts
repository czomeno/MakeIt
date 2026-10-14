import type { AuthUser } from './auth.js';
import type { BoardRole } from '../models/Board.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      // Adjuntados por requireBoardRole tras resolver la membresía del tablero.
      boardId?: string;
      boardRole?: BoardRole;
    }
  }
}

export {};
