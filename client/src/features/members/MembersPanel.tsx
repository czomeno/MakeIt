import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useMembersQuery, useUpdateMemberRoleMutation, useRemoveMemberMutation } from './hooks';
import { Dropdown } from '../../components/Dropdown';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Spinner } from '../../components/Spinner';
import { ApiError } from '../../api/client';
import { toastError, toastSuccess } from '../../stores/toastStore';
import { avatarColorFor } from '../../lib/badgeColors';
import type { BoardRole, Member } from '../../types/api';

const ROLE_LABELS: Record<BoardRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Lector',
};
const ROLES: BoardRole[] = ['admin', 'editor', 'viewer'];

interface MembersPanelProps {
  boardId: string;
  isAdmin: boolean;
  ownerId: string;
}

export function MembersPanel({ boardId, isAdmin, ownerId }: MembersPanelProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const query = useMembersQuery(boardId);
  const updateRole = useUpdateMemberRoleMutation(boardId);
  const removeMember = useRemoveMemberMutation(boardId);
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null);

  if (query.isPending) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }

  if (query.isError) {
    return <p className="text-sm text-danger">No se pudieron cargar los miembros.</p>;
  }

  function handleRoleChange(member: Member, role: BoardRole) {
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onError: (error: unknown) => {
          toastError(error instanceof ApiError ? error.message : 'No se pudo cambiar el rol.');
        },
      },
    );
  }

  function confirmRemoval() {
    if (!pendingRemoval) {
      return;
    }
    const isSelf = pendingRemoval.userId === currentUserId;
    removeMember.mutate(pendingRemoval.userId, {
      onSuccess: () => {
        toastSuccess(isSelf ? 'Has abandonado el tablero.' : 'Miembro expulsado.');
        setPendingRemoval(null);
      },
      onError: (error: unknown) => {
        toastError(error instanceof ApiError ? error.message : 'No se pudo completar la acción.');
        setPendingRemoval(null);
      },
    });
  }

  const isSelfLeaving = pendingRemoval?.userId === currentUserId;

  return (
    <div className="flex flex-col gap-2">
      {query.data.map((member) => {
        const isSelf = member.userId === currentUserId;
        const isOwner = member.userId === ownerId;
        const canManage = !isOwner && (isSelf || isAdmin);

        return (
          <div
            key={member.userId}
            className="flex items-center gap-3 rounded-lg border border-border p-2.5"
          >
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColorFor(member.email || member.name)}`}
            >
              {(member.name || member.email).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">
                {member.name || member.email}{' '}
                {isSelf && <span className="text-text-muted">(tú)</span>}
              </p>
              <p className="truncate text-xs text-text-muted">{member.email}</p>
            </div>

            {isAdmin && !isOwner ? (
              <Dropdown
                variant="compact"
                className="shrink-0"
                ariaLabel={`Rol de ${member.name || member.email}`}
                value={member.role}
                onChange={(role) => handleRoleChange(member, role)}
                options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
              />
            ) : (
              <span className="shrink-0 text-xs text-text-muted">
                {ROLE_LABELS[member.role]}
                {isOwner ? ' · Propietario' : ''}
              </span>
            )}

            {canManage && (
              <button
                type="button"
                onClick={() => setPendingRemoval(member)}
                aria-label={
                  isSelf ? 'Abandonar tablero' : `Expulsar a ${member.name || member.email}`
                }
                className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-danger"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        isOpen={!!pendingRemoval}
        title={isSelfLeaving ? 'Abandonar tablero' : 'Expulsar miembro'}
        description={
          isSelfLeaving
            ? '¿Seguro que quieres abandonar este tablero? Perderás el acceso de inmediato.'
            : `Se expulsará a ${pendingRemoval?.name || pendingRemoval?.email} de este tablero.`
        }
        confirmLabel={isSelfLeaving ? 'Abandonar' : 'Expulsar'}
        isDangerous
        isLoading={removeMember.isPending}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={confirmRemoval}
      />
    </div>
  );
}
