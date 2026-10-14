import { Activity, type ActivityType } from '../models/Activity.js';
import type { ActivityQuery } from '../schemas/activity.schema.js';

export interface RecordActivityInput {
  board: string;
  card?: string;
  actor: string;
  type: ActivityType;
  data?: Record<string, unknown>;
}

const MERGE_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;

// Agrupa ediciones de contenido menores: si la actividad más reciente de
// ESTA tarjeta ya es un "card.updated" del mismo autor hace menos de un
// minuto, se funde en ella (mismo createdAt, data actualizada) en vez de
// crear una fila nueva. El resto de tipos nunca se agrupan: son eventos
// discretos (crear, mover, borrar, miembros...) que el usuario espera ver
// todos, no solo el último.
export async function record(input: RecordActivityInput) {
  if (input.type === 'card.updated' && input.card) {
    const last = await Activity.findOne({ board: input.board, card: input.card }).sort({
      createdAt: -1,
    });

    if (
      last &&
      last.type === 'card.updated' &&
      last.actor.toString() === input.actor &&
      Date.now() - last.createdAt.getTime() < MERGE_WINDOW_MS
    ) {
      last.data = { ...(last.data as Record<string, unknown>), ...input.data };
      await last.save();
      return last.toObject();
    }
  }

  const activity = await Activity.create({
    board: input.board,
    card: input.card,
    actor: input.actor,
    type: input.type,
    data: input.data ?? {},
  });
  return activity.toObject();
}

export interface ActivityPage {
  items: Awaited<ReturnType<typeof queryPage>>['items'];
  nextCursor: string | null;
}

async function queryPage(filter: Record<string, unknown>, query: ActivityQuery) {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), 100);
  const where = query.cursor ? { ...filter, createdAt: { $lt: new Date(query.cursor) } } : filter;

  const docs = await Activity.find(where)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('actor', 'name email')
    .lean();

  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);
  return { items, hasMore };
}

export async function listForBoard(boardId: string, query: ActivityQuery): Promise<ActivityPage> {
  const { items, hasMore } = await queryPage({ board: boardId }, query);
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}

export async function listForCard(cardId: string, query: ActivityQuery): Promise<ActivityPage> {
  const { items, hasMore } = await queryPage({ card: cardId }, query);
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}
