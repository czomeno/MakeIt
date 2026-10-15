import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { useCreateBoardMutation } from './hooks';
import { ApiError } from '../../api/client';
import { toastError, toastSuccess } from '../../stores/toastStore';

const createBoardSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120),
  description: z.string().trim().max(2000).optional(),
  template: z.enum(['generic', 'job-applications']),
});

type CreateBoardFormValues = z.infer<typeof createBoardSchema>;

const TEMPLATE_DESCRIPTIONS: Record<CreateBoardFormValues['template'], string> = {
  generic: 'Crea las columnas: Por hacer, En curso, Hecho.',
  'job-applications':
    'Crea las columnas: Por aplicar, Enviada, Entrevista, Prueba técnica, Oferta, Rechazada.',
};

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBoardModal({ isOpen, onClose }: CreateBoardModalProps) {
  const navigate = useNavigate();
  const mutation = useCreateBoardMutation();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateBoardFormValues>({
    resolver: zodResolver(createBoardSchema),
    defaultValues: { template: 'generic' },
  });

  const template = watch('template');

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(values: CreateBoardFormValues) {
    mutation.mutate(values, {
      onSuccess: (board) => {
        toastSuccess('Tablero creado.');
        handleClose();
        navigate(`/boards/${board._id}`);
      },
      onError: (error: unknown) => {
        toastError(error instanceof ApiError ? error.message : 'No se pudo crear el tablero.');
      },
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo tablero">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input label="Título" error={errors.title?.message} {...register('title')} />
        <Textarea
          label="Descripción (opcional)"
          error={errors.description?.message}
          {...register('description')}
        />
        <Controller
          name="template"
          control={control}
          render={({ field }) => (
            <Select
              label="Plantilla"
              hint={TEMPLATE_DESCRIPTIONS[template]}
              options={[
                { value: 'generic', label: 'Genérico' },
                { value: 'job-applications', label: 'Candidaturas de empleo' },
              ]}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />

        <div className="mt-2 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Crear tablero
          </Button>
        </div>
      </form>
    </Modal>
  );
}
