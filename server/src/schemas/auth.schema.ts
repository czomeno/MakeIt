import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres').max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// Misma regla de longitud que el registro para la contraseña nueva.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
    newPassword: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres').max(72),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'La contraseña nueva debe ser distinta de la actual',
    path: ['newPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
