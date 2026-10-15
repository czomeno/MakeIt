import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { PRIORITY_OPTIONS } from '../../lib/priority';
import { useCreateCardMutation } from './hooks';
import { useMembersQuery } from '../members/hooks';
import { ApiError } from '../../api/client';
import { toastError, toastSuccess } from '../../stores/toastStore';
import { cardNoun } from '../../lib/cardNoun';
import type { BoardWithContent } from '../../types/api';

const createCardSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200, 'Máximo 200 caracteres'),
  columnId: z.string().min(1, 'Elige una categoría'),
  priority: z.enum(['', 'low', 'medium', 'high']),
  dueDate: z.string().optional(),
  description: z.string().trim().max(5000).optional(),
  labels: z.string().max(500).optional(),
  company: z.string().trim().max(120).optional(),
  jobUrl: z.union([z.string().trim().url('URL inválida'), z.literal('')]).optional(),
  assignees: z.array(z.string()).optional(),
});

type CreateCardFormValues = z.infer<typeof createCardSchema>;

interface CreateCardModalProps {
  board: BoardWithContent;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCardModal({ board, isOpen, onClose }: CreateCardModalProps) {
  const createCard = useCreateCardMutation(board._id);
  const membersQuery = useMembersQuery(board._id);
  const isJob = board.template === 'job-applications';
  const noun = cardNoun(board.template);

  const emptyValues = (): CreateCardFormValues => ({
    title: '',
    columnId: board.columns[0]?._id ?? '',
    priority: '',
    dueDate: '',
    description: '',
    labels: '',
    company: '',
    jobUrl: '',
    assignees: [],
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateCardFormValues>({
    resolver: zodResolver(createCardSchema),
    defaultValues: emptyValues(),
  });

  function handleClose() {
    reset(emptyValues());
    onClose();
  }

  function onSubmit(values: CreateCardFormValues) {
    // Por si la categoría elegida se borró mientras el pop-up estaba abierto.
    const columnId = board.columns.some((column) => column._id === values.columnId)
      ? values.columnId
      : board.columns[0]?._id;
    if (!columnId) {
      return;
    }
    const labels = (values.labels ?? '')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);
    createCard.mutate(
      {
        columnId,
        input: {
          title: values.title,
          ...(values.description && { description: values.description }),
          ...(labels.length > 0 && { labels }),
          ...(values.dueDate && { dueDate: values.dueDate }),
          ...(values.priority && { priority: values.priority }),
          ...(values.assignees?.length && { assignees: values.assignees }),
          ...(isJob && values.company && { company: values.company }),
          ...(isJob && values.jobUrl && { jobUrl: values.jobUrl }),
        },
      },
      {
        onSuccess: () => {
          toastSuccess(isJob ? 'Candidatura añadida.' : 'Tarea añadida.');
          handleClose();
        },
        onError: (error: unknown) => {
          toastError(error instanceof ApiError ? error.message : `No se pudo añadir la ${noun}.`);
        },
      },
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Nueva ${noun}`}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input
          label={isJob ? 'Puesto' : 'Título'}
          placeholder={isJob ? 'Ej.: Desarrollador/a frontend' : 'Ej.: Preparar la presentación'}
          error={errors.title?.message}
          {...register('title')}
        />

        {isJob && (
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="columnId"
            control={control}
            render={({ field }) => (
              <Select
                label={isJob ? 'Estado' : 'Categoría'}
                options={board.columns.map((column) => ({
                  value: column._id,
                  label: column.title,
                }))}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.columnId?.message}
              />
            )}
          />
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select
                label="Prioridad"
                options={[{ value: '', label: 'Sin prioridad' }, ...PRIORITY_OPTIONS]}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </div>

        <Input
          label="Fecha límite"
          type="date"
          error={errors.dueDate?.message}
          {...register('dueDate')}
        />
        <Textarea
          label={isJob ? 'Notas' : 'Descripción'}
          error={errors.description?.message}
          {...register('description')}
        />
        <Input
          label="Etiquetas"
          hint="Sepáralas con comas."
          error={errors.labels?.message}
          {...register('labels')}
        />

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

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={createCard.isPending}>
            Añadir {noun}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
