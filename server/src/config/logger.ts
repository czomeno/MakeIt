import { pino, type DestinationStream, type Level } from 'pino';
import { env } from './env.js';
import { appVersion } from './version.js';

// Rutas que NUNCA deben salir en un log, aunque alguien registre por error el
// objeto entero (cabeceras, cuerpo de una petición, un documento de usuario...).
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.tokenHash',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
];

// Factoría para poder comprobar en tests qué se escribe realmente (redacción
// incluida) sin depender de stdout.
export function buildLogger(options: {
  level: Level | 'silent';
  pretty?: boolean;
  destination?: DestinationStream;
}) {
  return pino(
    {
      level: options.level,
      base: { service: 'makeit-api', version: appVersion },
      redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
      // JSON de una línea en producción (lo que esperan las plataformas de
      // logs); legible en desarrollo. pino-pretty es dependencia de desarrollo.
      ...(options.pretty && {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service,version' },
        },
      }),
    },
    options.destination,
  );
}

export const logger = buildLogger({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info'),
  pretty: env.NODE_ENV === 'development',
});

export type Logger = typeof logger;
