// Contrato de eventos de Socket.io entre servidor y cliente. Este archivo se
// duplica literalmente en client/src/socket/events.ts (un test de contrato
// en ambos lados comprueba que no diverjan) porque el cliente no puede
// importar código del servidor en el build de Vite.

export type BoardRoleLiteral = 'admin' | 'editor' | 'viewer';

export interface MemberEventPayload {
  userId: string;
  role: BoardRoleLiteral;
  name?: string;
  email?: string;
}

export interface PresenceUserPayload {
  userId: string;
  name: string;
  initials: string;
}

export interface SocketEventPayloads {
  'card:created': { card: unknown; actorId: string; clientId?: string };
  'card:updated': { card: unknown; actorId: string; clientId?: string };
  'card:moved': { card: unknown; actorId: string; clientId?: string };
  'card:deleted': { cardId: string; columnId: string; actorId: string; clientId?: string };
  'column:created': { column: unknown; actorId: string; clientId?: string };
  'column:updated': { column: unknown; actorId: string; clientId?: string };
  'column:moved': { column: unknown; actorId: string; clientId?: string };
  'column:deleted': { columnId: string; actorId: string; clientId?: string };
  'board:updated': { board: unknown; actorId: string; clientId?: string };
  'board:deleted': { boardId: string; actorId: string };
  'member:joined': { member: MemberEventPayload; actorId: string };
  'member:updated': { member: MemberEventPayload; actorId: string };
  'member:removed': { userId: string; actorId: string };
  'activity:created': { activity: unknown };
  'presence:update': { users: PresenceUserPayload[] };
}

export const SOCKET_EVENT_NAMES = Object.keys({
  'card:created': 0,
  'card:updated': 0,
  'card:moved': 0,
  'card:deleted': 0,
  'column:created': 0,
  'column:updated': 0,
  'column:moved': 0,
  'column:deleted': 0,
  'board:updated': 0,
  'board:deleted': 0,
  'member:joined': 0,
  'member:updated': 0,
  'member:removed': 0,
  'activity:created': 0,
  'presence:update': 0,
} satisfies Record<keyof SocketEventPayloads, 0>) as (keyof SocketEventPayloads)[];
