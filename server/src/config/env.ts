import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Admite server/.env y el .env de la raíz del monorepo.
loadDotenv({ path: ['.env', '../.env'] });

const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

// Fragmentos que delatan un secreto de ejemplo o de desarrollo copiado tal cual
// (p. ej. los de .env.example: "dev-access-secret-change-me-before-deploying").
const PLACEHOLDER_SECRET = /change-?me|example|ejemplo|placeholder|^dev-|secret-de-/i;
const MIN_PRODUCTION_SECRET_LENGTH = 32;

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGO_URI: z
      .string({ required_error: 'MONGO_URI es obligatoria' })
      .min(1, 'MONGO_URI es obligatoria')
      .regex(/^mongodb(\+srv)?:\/\//, 'MONGO_URI debe empezar por mongodb:// o mongodb+srv://'),
    // Solo hace falta si el cliente se sirve desde OTRO origen. Sin definir, la
    // API no responde a peticiones cross-origin (ni la API ni Socket.io).
    CORS_ORIGIN: z.string().min(1).optional(),
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
    INVITATION_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
    // URL pública de la app: base de los enlaces de invitación.
    APP_BASE_URL: z.string().url('APP_BASE_URL debe ser una URL absoluta').optional(),
    APP_NAME: z.string().min(1).default('MakeIt'),
    SOCKET_PATH: z.string().min(1).default('/socket.io'),
    // Nº de proxies de confianza delante de la API (1 en Render o detrás de
    // Caddy/nginx). Con 0, req.ip es la IP de la conexión directa.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    // Peticiones por IP cada 15 minutos.
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    INVITATIONS_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    // Sin definir: "silent" en tests, "info" en el resto.
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    // La fija la imagen de Docker en el build (sha o tag); si no, la del package.json.
    APP_VERSION: z.string().min(1).optional(),
    // Render la inyecta en cada despliegue: respaldo de APP_VERSION.
    RENDER_GIT_COMMIT: z.string().min(1).optional(),
    // Margen para terminar las peticiones en curso al recibir SIGTERM.
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    // Imagen única de producción: la API sirve también el frontend compilado.
    SERVE_CLIENT: booleanFlag,
    CLIENT_DIST_PATH: z.string().min(1).default('./public'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') {
      return;
    }
    // En producción la app NO arranca con secretos de ejemplo, cortos o repetidos.
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const secret = value[key];
      if (secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `en producción debe tener al menos ${MIN_PRODUCTION_SECRET_LENGTH} caracteres (genera uno con: openssl rand -base64 48)`,
        });
      }
      if (PLACEHOLDER_SECRET.test(secret)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'parece un secreto de ejemplo o de desarrollo; genera uno nuevo',
        });
      }
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'debe ser distinto de JWT_ACCESS_SECRET',
      });
    }
    if (!value.APP_BASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_BASE_URL'],
        message: 'es obligatoria en producción (URL pública, p. ej. https://makeit.onrender.com)',
      });
    } else {
      const url = new URL(value.APP_BASE_URL);
      if (url.protocol !== 'https:' && !isLocalhost(url.hostname)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_BASE_URL'],
          message: 'debe usar https en producción',
        });
      }
    }
  })
  .transform((value) => ({
    ...value,
    // Fuera de producción conserva el valor por defecto del entorno de desarrollo.
    APP_BASE_URL: (value.APP_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
  }));

export type Env = z.infer<typeof envSchema>;

// Exportada para poder probar las reglas de producción sin reiniciar el proceso.
export function parseEnv(
  source: NodeJS.ProcessEnv,
): { success: true; data: Env } | { success: false; errors: string[] } {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return {
    success: false,
    errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

const result = parseEnv(process.env);

if (!result.success) {
  console.error(
    `Configuración de entorno inválida:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`,
  );
  process.exit(1);
}

export const env = result.data;
