import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import * as invitationsApi from '../../api/invitations';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { ThemeToggle } from '../../components/ThemeToggle';

// Esta ruta vive bajo <ProtectedRoute>: si no hay sesión, ya se ha
// redirigido a /login (y de vuelta aquí tras autenticarse) antes de llegar.
export function AcceptInvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => invitationsApi.acceptInvitation(token),
    onSuccess: (data) => {
      navigate(`/boards/${data.boardId}`, { replace: true });
    },
    onError: (error: unknown) => {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'No se pudo aceptar la invitación.',
      );
    },
  });

  useEffect(() => {
    mutation.mutate();
    // Solo al montar (o si cambia el token): mutation no es estable entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex w-full max-w-sm items-center justify-between">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
            M
          </span>
          MakeIt
        </span>
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        {errorMessage ? (
          <>
            <h1 className="mb-2 text-lg font-semibold text-text">No hemos podido añadirte</h1>
            <p className="mb-6 text-sm text-text-muted">{errorMessage}</p>
            <Button type="button" onClick={() => navigate('/boards')}>
              Ir a mis tableros
            </Button>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Spinner size="lg" />
            </div>
            <p className="mt-4 text-sm text-text-muted">Comprobando tu invitación...</p>
          </>
        )}
      </div>
    </div>
  );
}
