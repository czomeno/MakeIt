import { Board, type BoardTemplate } from '../models/Board.js';
import { Column } from '../models/Column.js';
import { Card } from '../models/Card.js';
import { AppError } from '../errors/AppError.js';
import { emitToBoard, closeBoardRoom } from './realtime.service.js';
import type { CreateBoardInput, UpdateBoardInput } from '../schemas/boards.schema.js';

const TEMPLATE_COLUMNS: Record<BoardTemplate, string[]> = {
  generic: ['Por hacer', 'En curso', 'Hecho'],
  'job-applications': [
    'Por aplicar',
    'Enviada',
    'Entrevista',
    'Prueba técnica',
    'Oferta',
    'Rechazada',
  ],
};

export async function listForUser(userId: string) {
  return Board.find({ 'members.user': userId }).sort({ updatedAt: -1 }).lean();
}

export async function create(userId: string, input: CreateBoardInput) {
  const board = await Board.create({
    title: input.title,
    description: input.description,
    template: input.template,
    owner: userId,
    members: [{ user: userId, role: 'admin' }],
  });

  const titles = TEMPLATE_COLUMNS[input.template];
  await Column.insertMany(
    titles.map((title, index) => ({ board: board._id, title, position: (index + 1) * 1000 })),
  );

  return board.toObject();
}

// Tablero + columnas ordenadas + tarjetas ordenadas, en 3 consultas (sin N+1).
export async function getWithContent(boardId: string) {
  const board = await Board.findById(boardId).lean();
  if (!board) {
    throw AppError.notFound('Tablero no encontrado');
  }

  const [columns, cards] = await Promise.all([
    Column.find({ board: boardId }).sort({ position: 1 }).lean(),
    Card.find({ board: boardId }).sort({ position: 1 }).lean(),
  ]);

  const cardsByColumn = new Map<string, typeof cards>();
  for (const card of cards) {
    const key = card.column.toString();
    const bucket = cardsByColumn.get(key);
    if (bucket) {
      bucket.push(card);
    } else {
      cardsByColumn.set(key, [card]);
    }
  }

  return {
    ...board,
    columns: columns.map((column) => ({
      ...column,
      cards: cardsByColumn.get(column._id.toString()) ?? [],
    })),
  };
}

// No hay tipo de actividad para "board.updated"/"board.deleted" (el
// historial de Parte 2 solo cubre tarjetas, columnas y miembros), así que
// estos dos emiten directo por socket en vez de pasar por events.service.
export async function update(
  boardId: string,
  input: UpdateBoardInput,
  actorId: string,
  clientId?: string,
) {
  const board = await Board.findByIdAndUpdate(boardId, input, { new: true });
  if (!board) {
    throw AppError.notFound('Tablero no encontrado');
  }
  emitToBoard(boardId, 'board:updated', { board: board.toObject(), actorId, clientId });
  return board.toObject();
}

export async function remove(boardId: string, actorId: string): Promise<void> {
  await Promise.all([Card.deleteMany({ board: boardId }), Column.deleteMany({ board: boardId })]);
  await Board.deleteOne({ _id: boardId });
  emitToBoard(boardId, 'board:deleted', { boardId, actorId });
  closeBoardRoom(boardId);
}
