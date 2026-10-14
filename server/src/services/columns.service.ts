import { Column } from '../models/Column.js';
import { Card } from '../models/Card.js';
import { AppError } from '../errors/AppError.js';
import { calculatePosition } from '../utils/calculatePosition.js';
import { needsRebalance, rebalancedPositions } from '../utils/rebalance.js';
import { publish } from './events.service.js';
import type {
  CreateColumnInput,
  UpdateColumnInput,
  MoveColumnInput,
} from '../schemas/columns.schema.js';

export async function create(
  boardId: string,
  input: CreateColumnInput,
  actorId: string,
  clientId?: string,
) {
  const last = await Column.findOne({ board: boardId }).sort({ position: -1 }).lean();
  const position = calculatePosition(last?.position, undefined);
  const column = await Column.create({ board: boardId, title: input.title, position });

  await publish({
    board: boardId,
    activity: {
      actor: actorId,
      type: 'column.created',
      data: { columnTitle: column.title },
    },
    socket: { event: 'column:created', payload: { column: column.toObject(), actorId, clientId } },
  });

  return column.toObject();
}

export async function update(
  boardId: string,
  columnId: string,
  input: UpdateColumnInput,
  actorId: string,
  clientId?: string,
) {
  const before = await Column.findById(columnId).select('title').lean();
  if (!before) {
    throw AppError.notFound('Columna no encontrada');
  }

  const column = await Column.findByIdAndUpdate(columnId, input, { new: true });
  if (!column) {
    throw AppError.notFound('Columna no encontrada');
  }

  await publish({
    board: boardId,
    activity: {
      actor: actorId,
      type: 'column.renamed',
      data: { oldTitle: before.title, newTitle: column.title },
    },
    socket: { event: 'column:updated', payload: { column: column.toObject(), actorId, clientId } },
  });

  return column.toObject();
}

export async function remove(
  boardId: string,
  columnId: string,
  actorId: string,
  clientId?: string,
): Promise<void> {
  const column = await Column.findById(columnId).select('title').lean();
  if (!column) {
    throw AppError.notFound('Columna no encontrada');
  }

  await Card.deleteMany({ column: columnId });
  await Column.deleteOne({ _id: columnId });

  await publish({
    board: boardId,
    activity: {
      actor: actorId,
      type: 'column.deleted',
      data: { columnTitle: column.title },
    },
    socket: { event: 'column:deleted', payload: { columnId, actorId, clientId } },
  });
}

export async function move(
  boardId: string,
  columnId: string,
  input: MoveColumnInput,
  actorId: string,
  clientId?: string,
) {
  const [prev, next] = await Promise.all([
    input.prevColumnId ? Column.findOne({ _id: input.prevColumnId, board: boardId }).lean() : null,
    input.nextColumnId ? Column.findOne({ _id: input.nextColumnId, board: boardId }).lean() : null,
  ]);

  if (input.prevColumnId && !prev) {
    throw AppError.badRequest('La columna vecina anterior no pertenece a este tablero');
  }
  if (input.nextColumnId && !next) {
    throw AppError.badRequest('La columna vecina siguiente no pertenece a este tablero');
  }

  const column = needsRebalance(prev?.position, next?.position)
    ? await rebalanceAndMove(boardId, columnId, input.prevColumnId, input.nextColumnId)
    : await (async () => {
        const position = calculatePosition(prev?.position, next?.position);
        const updated = await Column.findByIdAndUpdate(columnId, { position }, { new: true });
        if (!updated) {
          throw AppError.notFound('Columna no encontrada');
        }
        return updated.toObject();
      })();

  await publish({
    board: boardId,
    activity: {
      actor: actorId,
      type: 'column.moved',
      data: { columnTitle: column.title },
    },
    socket: { event: 'column:moved', payload: { column, actorId, clientId } },
  });

  return column;
}

// Mismo mecanismo que cards.service: renumera todas las columnas del
// tablero con hueco uniforme cuando dos vecinas quedan demasiado juntas.
async function rebalanceAndMove(
  boardId: string,
  columnId: string,
  prevColumnId: string | undefined,
  nextColumnId: string | undefined,
) {
  const siblings = await Column.find({ board: boardId }).sort({ position: 1 }).lean();
  const others = siblings.filter((c) => c._id.toString() !== columnId).map((c) => c._id.toString());

  const insertAt = prevColumnId
    ? others.indexOf(prevColumnId) + 1
    : nextColumnId
      ? others.indexOf(nextColumnId)
      : others.length;

  const positions = rebalancedPositions(others, insertAt, columnId);
  await Promise.all(
    [...positions.entries()].map(([id, position]) => Column.updateOne({ _id: id }, { position })),
  );

  const column = await Column.findById(columnId);
  if (!column) {
    throw AppError.notFound('Columna no encontrada');
  }
  return column.toObject();
}
