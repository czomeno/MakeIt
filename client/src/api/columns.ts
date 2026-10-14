import { apiRequest } from './client';
import type { Column } from '../types/api';

export interface CreateColumnInput {
  title: string;
}

export interface UpdateColumnInput {
  title: string;
}

export interface MoveColumnInput {
  prevColumnId?: string;
  nextColumnId?: string;
}

export async function createColumn(boardId: string, input: CreateColumnInput): Promise<Column> {
  const data = await apiRequest<{ column: Column }>(`/boards/${boardId}/columns`, {
    method: 'POST',
    body: input,
  });
  return data.column;
}

export async function updateColumn(id: string, input: UpdateColumnInput): Promise<Column> {
  const data = await apiRequest<{ column: Column }>(`/columns/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return data.column;
}

export function deleteColumn(id: string): Promise<void> {
  return apiRequest<void>(`/columns/${id}`, { method: 'DELETE' });
}

export async function moveColumn(id: string, input: MoveColumnInput): Promise<Column> {
  const data = await apiRequest<{ column: Column }>(`/columns/${id}/move`, {
    method: 'PATCH',
    body: input,
  });
  return data.column;
}
