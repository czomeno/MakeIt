import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// Mínimo de 10 caracteres: misma regla que el backend (schemas/auth.schema.ts).
export const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z
    .string()
    .min(10, 'La contraseña debe tener al menos 10 caracteres')
    .max(72, 'Máximo 72 caracteres'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
    newPassword: z
      .string()
      .min(10, 'La contraseña debe tener al menos 10 caracteres')
      .max(72, 'Máximo 72 caracteres'),
    confirmPassword: z.string().min(1, 'Repite la contraseña nueva'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'La contraseña nueva debe ser distinta de la actual',
    path: ['newPassword'],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
