import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocket } from './socket/index.js';

async function bootstrap(): Promise<void> {
  await connectDB(env.MONGO_URI);

  const app = createApp();
  // Socket.io cuelga del mismo servidor HTTP que Express, no de uno aparte.
  const httpServer = createServer(app);
  initSocket(httpServer);

  const server = httpServer.listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n${signal} recibido, cerrando servidor...`);
    server.close(() => {
      void disconnectDB().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void bootstrap();
