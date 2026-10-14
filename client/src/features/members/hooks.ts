import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as membersApi from '../../api/members';
import * as invitationsApi from '../../api/invitations';
import { boardsKeys } from '../boards/hooks';
import type { BoardRole } from '../../types/api';

export const membersKeys = {
  list: (boardId: string) => ['boards', boardId, 'members'] as const,
};

export const invitationsKeys = {
  list: (boardId: string) => ['boards', boardId, 'invitations'] as const,
};

export function useMembersQuery(boardId: string) {
  return useQuery({
    queryKey: membersKeys.list(boardId),
    queryFn: () => membersApi.listMembers(boardId),
  });
}

export function useInvitationsQuery(boardId: string, enabled: boolean) {
  return useQuery({
    queryKey: invitationsKeys.list(boardId),
    queryFn: () => invitationsApi.listInvitations(boardId),
    enabled,
  });
}

export function useUpdateMemberRoleMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: BoardRole }) =>
      membersApi.updateMemberRole(boardId, userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membersKeys.list(boardId) });
      // El rol también vive embebido en board.members (de donde BoardPage
      // deriva canEdit/isAdmin), así que ese cache también hay que refrescarlo.
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}

export function useRemoveMemberMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => membersApi.removeMember(boardId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membersKeys.list(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardsKeys.detail(boardId) });
    },
  });
}

export function useCreateInvitationMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: invitationsApi.CreateInvitationInput) =>
      invitationsApi.createInvitation(boardId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationsKeys.list(boardId) });
    },
  });
}

export function useRevokeInvitationMutation(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: invitationsApi.revokeInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationsKeys.list(boardId) });
    },
  });
}
