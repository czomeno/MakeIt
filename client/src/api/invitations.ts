import { apiRequest } from './client';
import type { BoardRole, Invitation } from '../types/api';

export interface CreateInvitationInput {
  email: string;
  role: BoardRole;
}

export interface CreateInvitationResult {
  invitation: Invitation;
  link: string;
}

export async function createInvitation(
  boardId: string,
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  return apiRequest<CreateInvitationResult>(`/boards/${boardId}/invitations`, {
    method: 'POST',
    body: input,
  });
}

export async function listInvitations(boardId: string): Promise<Invitation[]> {
  const data = await apiRequest<{ invitations: Invitation[] }>(`/boards/${boardId}/invitations`);
  return data.invitations;
}

export function revokeInvitation(id: string): Promise<void> {
  return apiRequest<void>(`/invitations/${id}`, { method: 'DELETE' });
}

export async function acceptInvitation(token: string): Promise<{ boardId: string }> {
  return apiRequest<{ boardId: string }>('/invitations/accept', {
    method: 'POST',
    body: { token },
  });
}
