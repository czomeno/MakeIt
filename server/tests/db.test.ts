import { describe, it, expect, afterAll, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB, getDbStatus } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';

async function until(condition: () => boolean, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('La condición no se cumplió a tiempo');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// Mongo arranca DESPUÉS de que la API intente conectar: connectDB debe seguir
// reintentando en vez de rendirse al primer fallo.
describe('connectDB', () => {
  let mongod: MongoMemoryServer | undefined;

  afterAll(async () => {
    await disconnectDB();
    await mongod?.stop();
  });

  it('reintenta hasta que la base de datos está disponible', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    const port = 20_000 + Math.floor(Math.random() * 20_000);
    const connecting = connectDB(`mongodb://127.0.0.1:${port}/retry-test`, 50);

    // Espera a que falle al menos un intento (sin servidor todavía).
    await until(() =>
      errorSpy.mock.calls.some((call) => String(call[1]).includes('se reintentará')),
    );
    expect(getDbStatus()).toBe('disconnected');

    mongod = await MongoMemoryServer.create({ instance: { port } });
    await connecting;
    expect(getDbStatus()).toBe('connected');
  }, 60_000);
});
