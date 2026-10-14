import { useState, type FormEvent } from 'react';
import { useCreateColumnMutation } from './hooks';
import { Button } from '../../components/Button';
import { ApiError } from '../../api/client';
import { toastError } from '../../stores/toastStore';

interface CreateColumnFormProps {
  boardId: string;
}

export function CreateColumnForm({ boardId }: CreateColumnFormProps) {
  const [title, setTitle] = useState('');
  const mutation = useCreateColumnMutation(boardId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    mutation.mutate(
      { title: trimmed },
      {
        onSuccess: () => setTitle(''),
        onError: (error: unknown) => {
          toastError(error instanceof ApiError ? error.message : 'No se pudo crear la columna.');
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-2 rounded-xl border border-dashed border-border p-3 sm:flex-row sm:items-center"
    >
      <label htmlFor="new-column-title" className="shrink-0 text-sm font-medium text-text-muted">
        Nueva columna
      </label>
      <div className="flex max-w-sm gap-2">
        <input
          id="new-column-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Título de la columna"
          className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
        <Button
          type="submit"
          variant="secondary"
          isLoading={mutation.isPending}
          className="px-2.5 py-1.5 text-xs"
        >
          Crear
        </Button>
      </div>
    </form>
  );
}
