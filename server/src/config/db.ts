import mongoose from 'mongoose';
import { logger } from './logger.js';

export type DbStatus = 'connected' | 'disconnected';

const MAX_RETRY_DELAY_MS = 10_000;
let stopRetrying = false;

let listenersRegistered = false;
function registerListeners(): void {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;
  mongoose.connection.on('connected', () => logger.info('MongoDB: conexión establecida'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB: conexión perdida'));
  mongoose.connection.on('error', (error: unknown) =>
    logger.error({ err: error }, 'MongoDB: error de conexión'),
  );
}

// No lanza nunca: reintenta con espera creciente (0,5 s, 1 s, 2 s... hasta
// 10 s) hasta conectar. Mongoose NO reintenta por su cuenta si la PRIMERA
// conexión falla, y una API viva pero sin base de datos para siempre solo se
// detecta como "unhealthy" (Docker no la reinicia). Mientras tanto,
// /api/ready responde 503.
export async function connectDB(uri: string, baseDelayMs = 500): Promise<void> {
  registerListeners();
  stopRetrying = false;
  for (let attempt = 1; !stopRetrying; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
      return;
    } catch (error) {
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
      logger.error(
        { err: error, attempt, retryInMs: delay },
        'MongoDB: no se pudo conectar, se reintentará',
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** 1 = connected en la enumeración de readyState de Mongoose. */
export function getDbStatus(): DbStatus {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

export async function disconnectDB(): Promise<void> {
  stopRetrying = true;
  await mongoose.connection.close();
}
