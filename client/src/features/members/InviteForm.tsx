import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  useCreateInvitationMutation,
  useInvitationsQuery,
  useRevokeInvitationMutation,
} from './hooks';
import { ApiError } from '../../api/client';
import { toastError, toastSuccess } from '../../stores/toastStore';
import type { BoardRole, Invitation } from '../../types/api';

const inviteSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  role: z.enum(['admin', 'editor', 'viewer']),
});
type InviteFormValues = z.infer<typeof inviteSchema>;

const ROLE_LABELS: Record<BoardRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Lector',
};

interface InviteFormProps {
  boardId: string;
}

export function InviteForm({ boardId }: InviteFormProps) {
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<Invitation | null>(null);

  const invitationsQuery = useInvitationsQuery(boardId, true);
  const createInvitation = useCreateInvitationMutation(boardId);
  const revokeInvitation = useRevokeInvitationMutation(boardId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'editor' },
  });

  function onSubmit(values: InviteFormValues) {
    createInvitation.mutate(values, {
      onSuccess: (result) => {
        setLastLink(result.link);
        setCopied(false);
        reset({ email: '', role: values.role });
        toastSuccess('Invitación creada.');
      },
      onError: (error: unknown) => {
        toastError(error instanceof ApiError ? error.message : 'No se pudo crear la invitación.');
      },
    });
  }

  async function copyLink() {
    if (!lastLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lastLink);
      setCopied(true);
    } catch {
      toastError('No se pudo copiar el enlace.');
    }
  }

  function confirmRevoke() {
    if (!pendingRevoke) {
      return;
    }
    revokeInvitation.mutate(pendingRevoke.id, {
      onSuccess: () => {
        toastSuccess('Invitación revocada.');
        setPendingRevoke(null);
      },
      onError: (error: unknown) => {
        toastError(error instanceof ApiError ? error.message : 'No se pudo revocar la invitación.');
        setPendingRevoke(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Input
            label="Email"
            type="email"
            placeholder="persona@ejemplo.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>
        <Select label="Rol" error={errors.role?.message} className="sm:w-32" {...register('role')}>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Lector</option>
        </Select>
        <Button type="submit" isLoading={createInvitation.isPending}>
          Invitar
        </Button>
      </form>

      {lastLink && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg p-2.5">
          <input
            readOnly
            value={lastLink}
            aria-label="Enlace de invitación"
            className="min-w-0 flex-1 truncate bg-transparent text-xs text-text-muted focus-visible:outline-none"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void copyLink()}
            className="shrink-0 px-2.5 py-1.5 text-xs"
          >
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-text">Invitaciones pendientes</h3>
        {invitationsQuery.isPending ? (
          <p className="text-sm text-text-muted">Cargando...</p>
        ) : invitationsQuery.data && invitationsQuery.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {invitationsQuery.data.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  {invitation.email} · {ROLE_LABELS[invitation.role]}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingRevoke(invitation)}
                  className="shrink-0 text-xs text-danger hover:underline"
                >
                  Revocar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No hay invitaciones pendientes.</p>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!pendingRevoke}
        title="Revocar invitación"
        description={`Se revocará la invitación a ${pendingRevoke?.email}.`}
        confirmLabel="Revocar"
        isDangerous
        isLoading={revokeInvitation.isPending}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
