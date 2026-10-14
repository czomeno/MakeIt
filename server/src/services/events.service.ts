import * as activityService from './activity.service.js';
import { emitToBoard } from './realtime.service.js';
import type { RecordActivityInput } from './activity.service.js';
import type { SocketEventPayloads } from '../socket/events.js';

export interface PublishInput<E extends keyof SocketEventPayloads = keyof SocketEventPayloads> {
  board: string;
  activity: Omit<RecordActivityInput, 'board'>;
  // Evento de socket a difundir a la room del tablero. Opcional porque no
  // todas las llamadas necesitan avisar en vivo de inmediato (ninguna hoy lo
  // omite, pero deja la puerta abierta).
  socket?: { event: E; payload: SocketEventPayloads[E] };
}

// Único punto desde el que se registra actividad Y se difunde por
// Socket.io. Los servicios de dominio (boards/columns/cards/members/
// invitations) llaman aquí tras cada mutación con éxito; los controladores
// nunca llaman directamente a activity/realtime, así no se olvida ningún caso.
export async function publish<E extends keyof SocketEventPayloads>(
  input: PublishInput<E>,
): Promise<void> {
  const activity = await activityService.record({ board: input.board, ...input.activity });
  if (input.socket) {
    emitToBoard(input.board, input.socket.event, input.socket.payload);
  }
  emitToBoard(input.board, 'activity:created', { activity });
}
