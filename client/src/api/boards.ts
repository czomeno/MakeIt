import { apiRequest } from './client';
import type { Board, BoardWithContent, BoardTemplate } from '../types/api';

export interface CreateBoardInput {
  title: string;
  description?: string;
  template: BoardTemplate;
}

export interface UpdateBoardInput {
  title?: string;
  description?: string;
}

export async function listBoards(): Promise<Board[]> {
  const data = await apiRequest<{ boards: Board[] }>('/boards');
  return data.boards;
}

export async function getBoard(id: string): Promise<BoardWithContent> {
  const data = await apiRequest<{ board: BoardWithContent }>(`/boards/${id}`);
  return data.board;
}

export async function createBoard(input: CreateBoardInput): Promise<Board> {
  const data = await apiRequest<{ board: Board }>('/boards', { method: 'POST', body: input });
  return data.board;
}

export async function updateBoard(id: string, input: UpdateBoardInput): Promise<Board> {
  const data = await apiRequest<{ board: Board }>(`/boards/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return data.board;
}

export function deleteBoard(id: string): Promise<void> {
  return apiRequest<void>(`/boards/${id}`, { method: 'DELETE' });
}
