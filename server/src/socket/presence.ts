import type { PresenceUserPayload } from './events.js';

interface PresenceEntry {
  user: PresenceUserPayload;
  sockets: Set<string>;
}

// boardId -> userId -> entry. Varias pestañas del mismo usuario comparten
// una sola entrada de presencia (un Set de socketId); solo desaparece de la
// lista cuando se desconecta/sale el último socket de ese usuario.
const boards = new Map<string, Map<string, PresenceEntry>>();

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function addPresence(boardId: string, socketId: string, userId: string, name: string): void {
  let board = boards.get(boardId);
  if (!board) {
    board = new Map();
    boards.set(boardId, board);
  }
  let entry = board.get(userId);
  if (!entry) {
    entry = { user: { userId, name, initials: initials(name) }, sockets: new Set() };
    board.set(userId, entry);
  }
  entry.sockets.add(socketId);
}

export function removePresence(boardId: string, socketId: string): void {
  const board = boards.get(boardId);
  if (!board) {
    return;
  }
  for (const [userId, entry] of board.entries()) {
    if (entry.sockets.delete(socketId) && entry.sockets.size === 0) {
      board.delete(userId);
    }
  }
  if (board.size === 0) {
    boards.delete(boardId);
  }
}

// Al desconectar un socket no se sabe de antemano a qué tableros se había
// unido: recorre todos y limpia este socketId de cada uno. Devuelve los
// tableros afectados (para volver a emitir presence:update solo en esos).
export function removePresenceEverywhere(socketId: string): string[] {
  const affected: string[] = [];
  for (const [boardId, board] of boards.entries()) {
    let changed = false;
    for (const [userId, entry] of board.entries()) {
      if (entry.sockets.delete(socketId)) {
        changed = true;
        if (entry.sockets.size === 0) {
          board.delete(userId);
        }
      }
    }
    if (changed) {
      affected.push(boardId);
    }
    if (board.size === 0) {
      boards.delete(boardId);
    }
  }
  return affected;
}

export function removeUserFromBoard(boardId: string, userId: string): void {
  const board = boards.get(boardId);
  board?.delete(userId);
  if (board && board.size === 0) {
    boards.delete(boardId);
  }
}

export function listPresence(boardId: string): PresenceUserPayload[] {
  const board = boards.get(boardId);
  return board ? [...board.values()].map((entry) => entry.user) : [];
}
