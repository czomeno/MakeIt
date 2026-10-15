import { Card } from '../models/Card.js';
import { Column } from '../models/Column.js';
import { Board } from '../models/Board.js';
import { AppError } from '../errors/AppError.js';
import { calculatePosition } from '../utils/calculatePosition.js';
import { needsRebalance, rebalancedPositions } from '../utils/rebalance.js';
import { publish } from './events.service.js';
import type { CreateCardInput, UpdateCardInput, MoveCardInput } from '../schemas/cards.schema.js';

async function getColumnTitle(columnId: string): Promise<string> {
  const column = await Column.findById(columnId).select('title').lean();
  return column?.title ?? '';
}

// El schema ya valida que `assignees` son ObjectId; esto comprueba que
// además son miembros del tablero (el servidor nunca confía en lo que
// mande el cliente para esto).
async function assertAssigneesAreMembers(boardId: string, assignees: string[] | undefined) {
  if (!assignees || assignees.length === 0) {
    return;
  }
  const board = await Board.findById(boardId).select('members').lean();
  if (!board) {
    throw AppError.notFound('Tablero no encontrado');
  }
  const memberIds = new Set(board.members.map((member) => member.user.toString()));
  const unknown = assignees.filter((id) => !memberIds.has(id));
  if (unknown.length > 0) {
    throw AppError.badRequest('Solo se puede asignar a miembros del tablero', { unknown });
  }
}

export async function create(
  boardId: string,
  columnId: string,
  input: CreateCardInput,
  actorId: string,
  clientId?: string,
) {
  await assertAssigneesAreMembers(boardId, input.assignees);

  const last = await Card.findOne({ column: columnId }).sort({ position: -1 }).lean();
  const position = calculatePosition(last?.position, undefined);
  const card = await Card.create({
    ...input,
    priority: input.priority ?? undefined,
    board: boardId,
    column: columnId,
    position,
  });

  const columnTitle = await getColumnTitle(columnId);
  await publish({
    board: boardId,
    activity: {
      card: card._id.toString(),
      actor: actorId,
      type: 'card.created',
      data: { cardTitle: card.title, columnTitle },
    },
    socket: { event: 'card:created', payload: { card: card.toObject(), actorId, clientId } },
  });

  return card.toObject();
}

export async function update(
  boardId: string,
  cardId: string,
  input: UpdateCardInput,
  actorId: string,
  clientId?: string,
) {
  await assertAssigneesAreMembers(boardId, input.assignees);

  // priority: null significa "sin prioridad": se borra el campo en vez de
  // guardar un null.
  const { priority, ...rest } = input;
  const changes =
    priority === null
      ? { ...rest, $unset: { priority: 1 } }
      : { ...rest, ...(priority && { priority }) };
  const card = await Card.findByIdAndUpdate(cardId, changes, { new: true });
  if (!card) {
    throw AppError.notFound('Tarjeta no encontrada');
  }

  await publish({
    board: boardId,
    activity: {
      card: card._id.toString(),
      actor: actorId,
      type: 'card.updated',
      data: { cardTitle: card.title, fields: Object.keys(input) },
    },
    socket: { event: 'card:updated', payload: { card: card.toObject(), actorId, clientId } },
  });

  return card.toObject();
}

export async function remove(
  boardId: string,
  cardId: string,
  actorId: string,
  clientId?: string,
): Promise<void> {
  const card = await Card.findById(cardId).lean();
  if (!card) {
    throw AppError.notFound('Tarjeta no encontrada');
  }
  const columnTitle = await getColumnTitle(card.column.toString());

  await Card.deleteOne({ _id: cardId });

  await publish({
    board: boardId,
    activity: {
      actor: actorId,
      type: 'card.deleted',
      data: { cardTitle: card.title, columnTitle },
    },
    socket: {
      event: 'card:deleted',
      payload: { cardId, columnId: card.column.toString(), actorId, clientId },
    },
  });
}

export async function move(
  boardId: string,
  cardId: string,
  input: MoveCardInput,
  actorId: string,
  clientId?: string,
) {
  const current = await Card.findById(cardId).lean();
  if (!current) {
    throw AppError.notFound('Tarjeta no encontrada');
  }

  const targetColumn = await Column.findOne({ _id: input.columnId, board: boardId }).lean();
  if (!targetColumn) {
    throw AppError.badRequest('La columna de destino no pertenece a este tablero');
  }

  const [prev, next] = await Promise.all([
    input.prevCardId
      ? Card.findOne({ _id: input.prevCardId, column: input.columnId }).lean()
      : null,
    input.nextCardId
      ? Card.findOne({ _id: input.nextCardId, column: input.columnId }).lean()
      : null,
  ]);

  if (input.prevCardId && !prev) {
    throw AppError.badRequest('La tarjeta vecina anterior no está en esa columna');
  }
  if (input.nextCardId && !next) {
    throw AppError.badRequest('La tarjeta vecina siguiente no está en esa columna');
  }

  // Sin vecinos indicados: al final de la columna destino (igual que create()),
  // en vez de una posición fija que podría chocar con una tarjeta ya existente.
  let prevPosition = prev?.position;
  if (!input.prevCardId && !input.nextCardId) {
    const last = await Card.findOne({ column: input.columnId }).sort({ position: -1 }).lean();
    prevPosition = last?.position;
  }

  const card = needsRebalance(prevPosition, next?.position)
    ? await rebalanceAndMove(cardId, input.columnId, input.prevCardId, input.nextCardId)
    : await (async () => {
        const position = calculatePosition(prevPosition, next?.position);
        const updated = await Card.findByIdAndUpdate(
          cardId,
          { column: input.columnId, position },
          { new: true },
        );
        if (!updated) {
          throw AppError.notFound('Tarjeta no encontrada');
        }
        return updated.toObject();
      })();

  const [fromColumnTitle, toColumnTitle] = await Promise.all([
    getColumnTitle(current.column.toString()),
    getColumnTitle(input.columnId),
  ]);

  await publish({
    board: boardId,
    activity: {
      card: cardId,
      actor: actorId,
      type: 'card.moved',
      data: { cardTitle: current.title, fromColumnTitle, toColumnTitle },
    },
    socket: { event: 'card:moved', payload: { card, actorId, clientId } },
  });

  return card;
}

// El hueco entre vecinos se agotó: renumera TODA la columna destino (no solo
// el movido) con posiciones uniformemente espaciadas, con el movido ya en su
// hueco. El cliente no necesita enterarse: siempre refresca el tablero tras
// cada movimiento.
async function rebalanceAndMove(
  cardId: string,
  columnId: string,
  prevCardId: string | undefined,
  nextCardId: string | undefined,
) {
  const siblings = await Card.find({ column: columnId }).sort({ position: 1 }).lean();
  const others = siblings.filter((c) => c._id.toString() !== cardId).map((c) => c._id.toString());

  const insertAt = prevCardId
    ? others.indexOf(prevCardId) + 1
    : nextCardId
      ? others.indexOf(nextCardId)
      : others.length;

  const positions = rebalancedPositions(others, insertAt, cardId);
  await Promise.all(
    [...positions.entries()].map(([id, position]) =>
      Card.updateOne({ _id: id }, id === cardId ? { position, column: columnId } : { position }),
    ),
  );

  const card = await Card.findById(cardId);
  if (!card) {
    throw AppError.notFound('Tarjeta no encontrada');
  }
  return card.toObject();
}
