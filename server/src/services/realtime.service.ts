import type { Server, DefaultEventsMap } from 'socket.io';
import type { SocketData } from '../socket/types.js';
import type { SocketEventPayloads } from '../socket/events.js';
import { removeUserFromBoard, listPresence } from '../socket/presence.js';

type AppServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

// Guarda la instancia de io en un singleton de módulo: socket/index.ts la
// fija una vez al arrancar (setSocketServer), y el resto de servicios solo
// importan emitToBoard/kickUserFromBoard sin depender del bootstrap de
// Express/Socket.io (evita un import circular).
let io: AppServer | null = null;

export function setSocketServer(server: AppServer): void {
  io = server;
}

export function emitToBoard<E extends keyof SocketEventPayloads>(
  boardId: string,
  event: E,
  payload: SocketEventPayloads[E],
): void {
  io?.to(`board:${boardId}`).emit(event, payload);
}

// Saca a todos los sockets de este usuario de la room del tablero (al
// expulsarlo, al abandonar, o al borrar el tablero) y actualiza la
// presencia para los que queden.
export function kickUserFromBoard(boardId: string, userId: string): void {
  if (!io) {
    return;
  }
  const room = `board:${boardId}`;
  const socketIds = io.sockets.adapter.rooms.get(room);
  if (!socketIds) {
    return;
  }
  for (const socketId of socketIds) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket?.data.userId === userId) {
      void socket.leave(room);
    }
  }
  removeUserFromBoard(boardId, userId);
  io.to(room).emit('presence:update', { users: listPresence(boardId) });
}

export function closeBoardRoom(boardId: string): void {
  io?.in(`board:${boardId}`).socketsLeave(`board:${boardId}`);
}
