// Formas que devuelve la API (ver README del backend). Se tipan aquí en un
// único sitio; solo las respuestas de /auth se validan con Zod en el borde
// (api/auth.ts) porque un fallo silencioso ahí corrompe la sesión.

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type BoardRole = 'admin' | 'editor' | 'viewer';
export type BoardTemplate = 'generic' | 'job-applications';

export interface BoardMember {
  user: string;
  role: BoardRole;
}

export interface Board {
  _id: string;
  title: string;
  description?: string;
  template: BoardTemplate;
  owner: string;
  members: BoardMember[];
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  _id: string;
  board: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type CardPriority = 'low' | 'medium' | 'high';

export interface Card {
  _id: string;
  board: string;
  column: string;
  title: string;
  description?: string;
  position: number;
  labels: string[];
  dueDate?: string;
  assignees: string[];
  company?: string;
  jobUrl?: string;
  priority?: CardPriority;
  // Las tarjetas anteriores a este campo no lo traen: undefined = no hecha.
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnWithCards extends Column {
  cards: Card[];
}

export interface BoardWithContent extends Board {
  columns: ColumnWithCards[];
}

export interface Member {
  userId: string;
  role: BoardRole;
  name: string;
  email: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invitation {
  id: string;
  email: string;
  role: BoardRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export type ActivityType =
  | 'card.created'
  | 'card.updated'
  | 'card.moved'
  | 'card.deleted'
  | 'column.created'
  | 'column.renamed'
  | 'column.moved'
  | 'column.deleted'
  | 'member.joined'
  | 'member.left'
  | 'member.removed'
  | 'member.role_changed';

export interface ActivityItem {
  _id: string;
  board: string;
  card?: string;
  actor: { _id: string; name: string; email: string } | null;
  type: ActivityType;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
