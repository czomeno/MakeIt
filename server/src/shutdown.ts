import type { Server as HttpServer } from 'node:http';
import type { Server as SocketServer } from 'socket.io';
import type { Logger } from './config/logger.js';
import { markShuttingDown } from './config/lifecycle.js';

interface ShutdownDeps {
  httpServer: HttpServer;
  io: Pick<SocketServer, 'close'>;
  disconnectDB: () => Promise<void>;
  logger: Logger;
  timeoutMs: number;
  exit: (code: number) => void;
}

// Apagado ordenado, en este orden:
//  1. /api/ready pasa a 503 (deja de recibir tráfico nuevo de un balanceador).
//  2. io.close(): desconecta los sockets y cierra el servidor HTTP, que deja
//     de aceptar conexiones pero ESPERA a que terminen las peticiones en
//     curso (y cierra las conexiones keep-alive ociosas).
//  3. Cierra Mongo, ya sin peticiones que lo usen.
// Si algo se cuelga más de timeoutMs, sale igualmente con código 1.
// Llamarla varias veces (p. ej. SIGTERM + SIGINT) solo apaga una vez.
export function createShutdown(deps: ShutdownDeps) {
  let started: Promise<void> | null = null;

  return function shutdown(reason: string, exitCode = 0): Promise<void> {
    if (started) {
      return started;
    }
    markShuttingDown();
    deps.logger.info({ reason }, 'Apagado ordenado iniciado');

    const forceExit = setTimeout(() => {
      deps.logger.error({ timeoutMs: deps.timeoutMs }, 'Apagado forzado: se agotó el tiempo');
      deps.exit(1);
    }, deps.timeoutMs);
    forceExit.unref();

    started = (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          deps.io.close((error?: Error) => (error ? reject(error) : resolve()));
        });
        await deps.disconnectDB();
        deps.logger.info('Apagado ordenado completado');
        clearTimeout(forceExit);
        deps.exit(exitCode);
      } catch (error) {
        deps.logger.error({ err: error }, 'Error durante el apagado');
        clearTimeout(forceExit);
        deps.exit(1);
      }
    })();
    return started;
  };
}
