import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { captureMutationId } from './middleware/mutationId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { serveClient } from './middleware/serveClient.js';

// CSP pensada para la SPA servida desde el mismo origen. connect-src añade el
// origen wss:// explícito porque Safari antiguo no cubre WebSocket con 'self'.
function contentSecurityPolicy() {
  const publicUrl = new URL(env.APP_BASE_URL);
  const socketOrigin = `${publicUrl.protocol === 'https:' ? 'wss' : 'ws'}://${publicUrl.host}`;
  return {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'", socketOrigin],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      // Sin HTTPS (prueba local de la imagen en http://localhost) no se fuerza
      // la subida a https de los recursos.
      'upgrade-insecure-requests': publicUrl.protocol === 'https:' ? [] : null,
    },
  };
}

export function createApp() {
  const app = express();

  // Detrás de un proxy inverso (Render, Caddy), req.ip (y por tanto el rate
  // limit) debe salir de X-Forwarded-For y no de la IP del proxy.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger);
  // gzip de las respuestas (sobre todo el bundle del cliente en la imagen
  // única, que antes comprimía nginx).
  app.use(compression());
  app.use(helmet({ contentSecurityPolicy: contentSecurityPolicy() }));
  // Mismo origen por defecto: CORS solo si el cliente vive en otro origen.
  if (env.CORS_ORIGIN) {
    app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  }
  app.use(express.json());
  app.use(cookieParser());
  app.use(captureMutationId);

  app.use('/api', routes);
  // Una ruta de la API que no existe es un 404 JSON, nunca el index.html.
  app.use('/api', notFoundHandler);

  if (env.SERVE_CLIENT) {
    app.use(serveClient(env.CLIENT_DIST_PATH, env.SOCKET_PATH));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
