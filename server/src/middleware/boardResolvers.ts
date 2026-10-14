import type { Request } from 'express';
import { Column } from '../models/Column.js';
import { Card } from '../models/Card.js';
import { Invitation } from '../models/Invitation.js';

// Resuelven, a partir de la petición, el id del tablero al que pertenece el
// recurso referido por un parámetro de ruta. Los usa requireBoardRole.
export const fromParam =
  (paramName: string) =>
  (req: Request): string | null => {
    const value = req.params[paramName];
    return typeof value === 'string' ? value : null;
  };

export const fromColumnParam =
  (paramName: string) =>
  async (req: Request): Promise<string | null> => {
    const columnId = req.params[paramName];
    if (typeof columnId !== 'string') {
      return null;
    }
    const column = await Column.findById(columnId).select('board').lean();
    return column ? column.board.toString() : null;
  };

export const fromCardParam =
  (paramName: string) =>
  async (req: Request): Promise<string | null> => {
    const cardId = req.params[paramName];
    if (typeof cardId !== 'string') {
      return null;
    }
    const card = await Card.findById(cardId).select('board').lean();
    return card ? card.board.toString() : null;
  };

export const fromInvitationParam =
  (paramName: string) =>
  async (req: Request): Promise<string | null> => {
    const invitationId = req.params[paramName];
    if (typeof invitationId !== 'string') {
      return null;
    }
    const invitation = await Invitation.findById(invitationId).select('board').lean();
    return invitation ? invitation.board.toString() : null;
  };
