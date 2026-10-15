import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { Server as SocketServer } from 'socket.io';
import { createApp } from '../src/app.js';
import { buildLogger } from '../src/config/logger.js';
import { markShuttingDown, resetLifecycleForTests } from '../src/config/lifecycle.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createShutdown } from '../src/shutdown.js';
import { connectTestDB, closeTestDB } from './helpers/db.js';

const app = createApp();

beforeAll(connectTestDB);
afterAll(closeTestDB);
afterEach(resetLifecycleForTests);

describe('GET /api/health y /api/ready', () => {
  it('health informa de estado, versión y base de datos', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', db: 'connected' });
    expect(response.body.version).toMatch(/\S+/);
    expect(typeof response.body.uptime).toBe('number');
  });

  it('ready responde 200 con Mongo conectado', async () => {
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  it('ready responde 503 en cuanto empieza el apagado', async () => {
    markShuttingDown();
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 'not_ready', shuttingDown: true });
  });
});

describe('id de petición', () => {
  it('genera uno si no llega y lo devuelve en X-Request-Id', async () => {
    const response = await request(app).get('/api/health');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reutiliza el que manda el proxy si es válido', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('X-Request-Id', 'nginx-0123456789abcdef');
    expect(response.headers['x-request-id']).toBe('nginx-0123456789abcdef');
  });

  it('descarta uno con caracteres no permitidos (evita inyección en logs)', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('X-Request-Id', 'malo\\ninyectado-0123');
    expect(response.headers['x-request-id']).not.toContain('malo');
  });
});

describe('logger', () => {
  function captureLogger() {
    const lines: Record<string, unknown>[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        callback();
      },
    });
    return { log: buildLogger({ level: 'info', destination }), lines };
  }

  it('nunca escribe contraseñas, tokens ni cookies', () => {
    const { log, lines } = captureLogger();
    log.info(
      {
        req: { headers: { authorization: 'Bearer secreto', cookie: 'refreshToken=secreto' } },
        user: { email: 'ada@example.com', password: 'secreto', passwordHash: '$2a$secreto' },
        session: { accessToken: 'secreto', refreshToken: 'secreto' },
        invitation: { token: 'secreto', tokenHash: 'secreto' },
      },
      'evento',
    );
    const output = JSON.stringify(lines);
    expect(output).not.toContain('secreto');
    expect(output).toContain('ada@example.com');
    expect(output).toContain('[REDACTED]');
  });

  it('incluye servicio y versión en cada línea', () => {
    const { log, lines } = captureLogger();
    log.info('hola');
    expect(lines[0]).toMatchObject({ service: 'makeit-api', msg: 'hola' });
    expect(lines[0]?.version).toBeDefined();
  });
});

describe('errores no controlados en una ruta', () => {
  it('responden 500 genérico sin filtrar el mensaje interno', async () => {
    const broken = express();
    broken.get('/boom', () => {
      throw new Error('detalle interno con datos sensibles');
    });
    broken.use(errorHandler);

    const response = await request(broken).get('/boom');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
    });
  });
});

describe('apagado ordenado', () => {
  const silent = buildLogger({ level: 'silent' });

  async function startServer(handler: express.RequestHandler) {
    const slowApp = express();
    slowApp.get('/slow', handler);
    const httpServer: HttpServer = createServer(slowApp);
    const io = new SocketServer(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    return { httpServer, io, url: `http://127.0.0.1:${port}` };
  }

  it('espera a la petición en curso, cierra Mongo después y sale con 0', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const { httpServer, io, url } = await startServer(async (_req, res) => {
      requestStarted();
      await gate;
      res.json({ ok: true });
    });

    const order: string[] = [];
    const exit = jest.fn((code: number) => order.push(`exit:${code}`));
    const shutdown = createShutdown({
      httpServer,
      io,
      disconnectDB: async () => {
        order.push('db');
      },
      logger: silent,
      timeoutMs: 5000,
      exit,
    });

    const inFlight = fetch(`${url}/slow`);
    await started;
    const done = shutdown('SIGTERM');

    // Mientras la petición sigue en curso no se ha cerrado nada.
    expect(order).toEqual([]);
    release();

    const response = await inFlight;
    expect(response.status).toBe(200);
    await done;
    expect(order).toEqual(['db', 'exit:0']);
    // Una segunda señal no repite el apagado.
    await shutdown('SIGINT');
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('si algo se cuelga, fuerza la salida con código 1 tras el timeout', async () => {
    const { httpServer } = await startServer((_req, res) => {
      res.end();
    });
    const exited = new Promise<number>((resolve) => {
      const shutdown = createShutdown({
        httpServer,
        io: { close: () => undefined } as unknown as SocketServer,
        disconnectDB: async () => {},
        logger: silent,
        timeoutMs: 50,
        exit: resolve,
      });
      void shutdown('SIGTERM');
    });
    expect(await exited).toBe(1);
    httpServer.close();
  });
});
