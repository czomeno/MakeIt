import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';
import { logger } from '../config/logger.js';

// Reutiliza el id que mande un proxy (nginx lo envía como X-Request-Id) para
// poder seguir una petición de punta a punta; si no viene o no es válido, se
// genera uno. Se devuelve siempre en la respuesta.
const VALID_REQUEST_ID = /^[\w-]{8,128}$/;

function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

const QUIET_PATHS = new Set(['/api/health', '/api/ready']);

export const requestLogger = pinoHttp({
  logger,
  genReqId: requestId,
  // Las sondas de Docker/plataformas llaman cada pocos segundos: no aportan.
  autoLogging: { ignore: (req) => QUIET_PATHS.has(req.url ?? '') },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // IP del cliente según `trust proxy` (req.ip de Express): permite comprobar
  // en los logs de producción que no es la IP del proxy de la plataforma.
  customProps: (req) => ({ ip: (req as IncomingMessage & { ip?: string }).ip }),
  // Solo lo imprescindible: ni cabeceras (cookies, Authorization) ni cuerpos.
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
