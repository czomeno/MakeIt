import { apiRequest } from './client';
import type { BoardRole, Member } from '../types/api';

export async function listMembers(boardId: string): Promise<Member[]> {
  const data = await apiRequest<{ members: Member[] }>(`/boards/${boardId}/members`);
  return data.members;
}

export async function updateMemberRole(
  boardId: string,
  userId: string,
  role: BoardRole,
): Promise<Member> {
  const data = await apiRequest<{ member: Member }>(`/boards/${boardId}/members/${userId}`, {
    method: 'PATCH',
    body: { role },
  });
  return data.member;
}

export function removeMember(boardId: string, userId: string): Promise<void> {
  return apiRequest<void>(`/boards/${boardId}/members/${userId}`, { method: 'DELETE' });
}
