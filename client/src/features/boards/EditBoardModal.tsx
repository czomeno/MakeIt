import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Button } from '../../components/Button';
import { useUpdateBoardMutation } from './hooks';
import { ApiError } from '../../api/client';
import { toastError, toastSuccess } from '../../stores/toastStore';
import type { Board } from '../../types/api';

const editBoardSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120),
  description: z.string().trim().max(2000).optional(),
});

type EditBoardFormValues = z.infer<typeof editBoardSchema>;

interface EditBoardModalProps {
  board: Board;
  isOpen: boolean;
  onClose: () => void;
}

export function EditBoardModal({ board, isOpen, onClose }: EditBoardModalProps) {
  const mutation = useUpdateBoardMutation(board._id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditBoardFormValues>({
    resolver: zodResolver(editBoardSchema),
    values: { title: board.title, description: board.description ?? '' },
  });

  function onSubmit(values: EditBoardFormValues) {
    mutation.mutate(values, {
      onSuccess: () => {
        toastSuccess('Tablero actualizado.');
        onClose();
      },
      onError: (error: unknown) => {
        toastError(error instanceof ApiError ? error.message : 'No se pudo actualizar el tablero.');
      },
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar tablero">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input label="Título" error={errors.title?.message} {...register('title')} />
        <Textarea
          label="Descripción"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
