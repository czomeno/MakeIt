import { useId, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { toastSuccess } from '../../stores/toastStore';
import { changePasswordSchema, type ChangePasswordFormValues } from '../auth/schemas';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ThemeToggle } from '../../components/ThemeToggle';

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-surface p-5">
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      <p className="mt-1 mb-4 text-sm text-text-muted">{description}</p>
      {children}
    </section>
  );
}

function ChangePasswordForm() {
  const email = useAuthStore((state) => state.user?.email ?? '');
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) });

  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      reset();
      toastSuccess('Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos.');
    },
    onError: (error: unknown) => {
      // 400 que no es de validación: la contraseña actual no es correcta.
      if (error instanceof ApiError && error.status === 400 && error.code !== 'VALIDATION_ERROR') {
        setError('currentPassword', { message: error.message }, { shouldFocus: true });
        return;
      }
      setError('root', {
        message: error instanceof ApiError ? error.message : 'No se pudo cambiar la contraseña.',
      });
    },
  });

  return (
    <form
      onSubmit={handleSubmit(({ currentPassword, newPassword }) =>
        mutation.mutate({ currentPassword, newPassword }),
      )}
      noValidate
      className="flex max-w-sm flex-col gap-4"
    >
      {/* Para que el gestor de contraseñas sepa a qué cuenta pertenece. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Input
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Input
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 10 caracteres."
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Input
        label="Repite la contraseña nueva"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {errors.root?.message && (
        <p role="alert" className="text-sm text-danger">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" isLoading={mutation.isPending} className="self-start">
        Cambiar contraseña
      </Button>
    </form>
  );
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Ajustes</h1>
        <p className="mt-1 text-sm text-text-muted">Personaliza MakeIt y gestiona tu cuenta.</p>
      </div>

      <SettingsSection title="Visualización" description="Cómo se ve MakeIt en este dispositivo.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium">Tema</span>
          <ThemeToggle />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Contraseña"
        description="Al cambiarla se cerrarán tus sesiones en los demás dispositivos."
      >
        <ChangePasswordForm />
      </SettingsSection>
    </div>
  );
}
