import mongoose from 'mongoose';

export type DbStatus = 'connected' | 'disconnected';

// No lanza si falla: /api/health informa del estado real de la conexión.
export async function connectDB(uri: string): Promise<void> {
  mongoose.connection.on('connected', () => {
    console.log('MongoDB: conexión establecida');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB: conexión perdida');
  });

  mongoose.connection.on('error', (error: unknown) => {
    console.error('MongoDB: error de conexión', error);
  });

  try {
    await mongoose.connect(uri);
  } catch (error) {
    console.error('MongoDB: no se pudo conectar al arrancar', error);
  }
}

/** 1 = connected en la enumeración de readyState de Mongoose. */
export function getDbStatus(): DbStatus {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
}
