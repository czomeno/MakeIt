import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Admite server/.env y el .env de la raíz del monorepo.
loadDotenv({ path: ['.env', '../.env'] });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1, 'MONGO_URI es obligatoria'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  INVITATION_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  APP_BASE_URL: z.string().min(1).default('http://localhost:5173'),
  APP_NAME: z.string().min(1).default('MakeIt'),
  SOCKET_PATH: z.string().min(1).default('/socket.io'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalles = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Configuración de entorno inválida:\n${detalles}`);
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;
