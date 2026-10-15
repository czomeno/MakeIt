import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocket } from './socket/index.js';
import { createShutdown } from './shutdown.js';

function bootstrap(): void {
  // Sin await: la API empieza a escuchar ya (/api/health responde y
  // /api/ready da 503) mientras connectDB reintenta hasta tener Mongo.
  void connectDB(env.MONGO_URI);

  const app = createApp();
  // Socket.io cuelga del mismo servidor HTTP que Express, no de uno aparte.
  const httpServer = createServer(app);
  const io = initSocket(httpServer);

  const shutdown = createShutdown({
    httpServer,
    io,
    disconnectDB,
    logger,
    timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    exit: (code) => process.exit(code),
  });

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Un error no capturado deja el proceso en un estado desconocido: se
  // registra y se apaga de forma ordenada con código 1 para que el
  // orquestador (Docker, la plataforma) lo reinicie.
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Promesa rechazada sin capturar');
    void shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Excepción no capturada');
    void shutdown('uncaughtException', 1);
  });

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `API escuchando en http://localhost:${env.PORT}`,
    );
  });
}

bootstrap();
