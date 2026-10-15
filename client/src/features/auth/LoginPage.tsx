import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginFormValues } from './schemas';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Logo } from '../../components/Logo';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | undefined)?.from?.pathname ?? '/boards';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => {
      navigate(from, { replace: true });
    },
    onError: (error: unknown) => {
      // El backend ya responde el mismo mensaje genérico exista o no el
      // email; aquí solo se muestra tal cual, sin añadir más detalle.
      const message = error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.';
      setError('root', { message });
    },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex w-full max-w-sm items-center justify-between">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <Logo className="h-7 w-7" />
          MakeIt
        </span>
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-1 text-xl font-semibold">Iniciar sesión</h1>
        <p className="mb-6 text-sm text-text-muted">Accede a tus tableros.</p>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          noValidate
          className="flex flex-col gap-4"
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          {errors.root?.message && (
            <p role="alert" className="text-sm text-danger">
              {errors.root.message}
            </p>
          )}

          <Button type="submit" isLoading={mutation.isPending} className="mt-2 w-full">
            Entrar
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          ¿No tienes cuenta?{' '}
          <Link
            to="/register"
            state={location.state}
            className="text-accent hover:text-accent-hover"
          >
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
