import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useUpdateCardMutation, useDeleteCardMutation } from './hooks';
import { useMembersQuery } from '../members/hooks';
import { useCardActivityQuery } from '../activity/hooks';
import { activityMessage } from '../activity/activityMessage';
import { relativeTimeFromNow } from '../../lib/relativeTime';
import { ApiError } from '../../api/client';
import { toastError, toastSuccess } from '../../stores/toastStore';
import type { Card, BoardTemplate } from '../../types/api';

const cardDetailSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200),
  description: z.string().trim().max(5000).optional(),
  labels: z.string().max(500).optional(),
  dueDate: z.string().optional(),
  company: z.string().trim().max(120).optional(),
  jobUrl: z.union([z.string().trim().url('URL inválida'), z.literal('')]).optional(),
  assignees: z.array(z.string()).optional(),
});

type CardDetailFormValues = z.infer<typeof cardDetailSchema>;

interface CardDetailModalProps {
  boardId: string;
  template: BoardTemplate;
  card: Card;
  canEdit: boolean;
  isOpen: boolean;
  onClose: () => void;
}

function toDateInputValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}

function cardToFormValues(card: Card): CardDetailFormValues {
  return {
    title: card.title,
    description: card.description ?? '',
    labels: card.labels.join(', '),
    dueDate: toDateInputValue(card.dueDate),
    company: card.company ?? '',
    jobUrl: card.jobUrl ?? '',
    assignees: card.assignees,
  };
}

// Mover de columna/posición ya no se hace aquí: lo cubre el drag & drop del
// tablero (con el KeyboardSensor como alternativa accesible).
export function CardDetailModal({
  boardId,
  template,
  card,
  canEdit,
  isOpen,
  onClose,
}: CardDetailModalProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // Si llega una actualización remota mientras hay cambios sin guardar, no
  // se pisan en silencio: se avisa y se espera a que decidas recargar.
  const [hasRemoteChange, setHasRemoteChange] = useState(false);
  const lastSyncedCardRef = useRef(card);

  const updateCard = useUpdateCardMutation(boardId);
  const deleteCard = useDeleteCardMutation(boardId);
  const membersQuery = useMembersQuery(boardId);
  const activityQuery = useCardActivityQuery(card._id, isOpen);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CardDetailFormValues>({
    resolver: zodResolver(cardDetailSchema),
    defaultValues: cardToFormValues(card),
  });

  useEffect(() => {
    if (card === lastSyncedCardRef.current) {
      return;
    }
    if (isDirty) {
      setHasRemoteChange(true);
      return;
    }
    reset(cardToFormValues(card));
    lastSyncedCardRef.current = card;
  }, [card, isDirty, reset]);

  function discardLocalChangesAndReload() {
    reset(cardToFormValues(card));
    lastSyncedCardRef.current = card;
    setHasRemoteChange(false);
  }

  function onSubmit(values: CardDetailFormValues) {
    updateCard.mutate(
      {
        id: card._id,
        input: {
          title: values.title,
          description: values.description || undefined,
          labels: values.labels
            ? values.labels
                .split(',')
                .map((label) => label.trim())
                .filter(Boolean)
            : [],
          dueDate: values.dueDate || undefined,
          company: values.company || undefined,
          jobUrl: values.jobUrl || undefined,
          assignees: values.assignees ?? [],
        },
      },
      {
        onSuccess: () => {
          // Limpia isDirty YA (no esperar al refetch): si no, el efecto que
          // vigila cambios remotos vería `isDirty` todavía en true al llegar
          // la tarjeta ya guardada y la confundiría con un cambio ajeno.
          reset(values);
          lastSyncedCardRef.current = card;
          toastSuccess('Tarjeta actualizada.');
        },
        onError: (error: unknown) => {
          toastError(
            error instanceof ApiError ? error.message : 'No se pudo actualizar la tarjeta.',
          );
        },
      },
    );
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Detalle de la tarjeta">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {hasRemoteChange && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-text">
              <span>Esta tarjeta ha cambiado mientras la editabas.</span>
              <Button
                type="button"
                variant="secondary"
                onClick={discardLocalChangesAndReload}
                className="shrink-0 px-2.5 py-1 text-xs"
              >
                Recargar
              </Button>
            </div>
          )}

          <fieldset disabled={!canEdit} className="flex flex-col gap-4">
            <Input label="Título" error={errors.title?.message} {...register('title')} />
            <Textarea
              label="Descripción"
              error={errors.description?.message}
              {...register('description')}
            />
            <Input
              label="Etiquetas"
              hint="Sepáralas con comas."
              error={errors.labels?.message}
              {...register('labels')}
            />
            <Input
              label="Fecha límite"
              type="date"
              error={errors.dueDate?.message}
              {...register('dueDate')}
            />

            {template === 'job-applications' && (
              <>
                <Input label="Empresa" error={errors.company?.message} {...register('company')} />
                <Input
                  label="Enlace de la oferta"
                  type="url"
                  placeholder="https://..."
                  error={errors.jobUrl?.message}
                  {...register('jobUrl')}
                />
              </>
            )}

            {membersQuery.data && membersQuery.data.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text">Asignados</span>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {membersQuery.data.map((member) => (
                    <label
                      key={member.userId}
                      className="flex items-center gap-1.5 text-sm text-text-muted"
                    >
                      <input
                        type="checkbox"
                        value={member.userId}
                        {...register('assignees')}
                        className="rounded border-border"
                      />
                      {member.name || member.email}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <span className="text-sm font-medium text-text">Actividad reciente</span>
            {activityQuery.isPending ? (
              <p className="text-xs text-text-muted">Cargando...</p>
            ) : activityQuery.isError ? (
              <p className="text-xs text-danger">No se pudo cargar la actividad.</p>
            ) : (
              (() => {
                const items = activityQuery.data.pages.flatMap((page) => page.items);
                return items.length === 0 ? (
                  <p className="text-xs text-text-muted">Sin actividad todavía.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {items.slice(0, 5).map((item) => (
                      <li key={item._id} className="text-xs text-text-muted">
                        {activityMessage(item)} · {relativeTimeFromNow(item.createdAt)}
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            {canEdit ? (
              <Button type="button" variant="danger" onClick={() => setIsDeleteOpen(true)}>
                Borrar tarjeta
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
              {canEdit && (
                <Button type="submit" isLoading={updateCard.isPending} disabled={!isDirty}>
                  Guardar cambios
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Borrar tarjeta"
        description={`Se borrará "${card.title}". Esta acción no se puede deshacer.`}
        confirmLabel="Borrar tarjeta"
        isDangerous
        isLoading={deleteCard.isPending}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() =>
          deleteCard.mutate(card._id, {
            onSuccess: () => {
              toastSuccess('Tarjeta borrada.');
              setIsDeleteOpen(false);
              onClose();
            },
            onError: (error: unknown) => {
              toastError(
                error instanceof ApiError ? error.message : 'No se pudo borrar la tarjeta.',
              );
            },
          })
        }
      />
    </>
  );
}
