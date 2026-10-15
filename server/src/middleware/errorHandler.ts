import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` },
  });
};

// Errores de body-parser (express.json): JSON mal formado, cuerpo demasiado
// grande... Traen un `status` 4xx y `expose: true`; son culpa del cliente y
// no deben responderse (ni registrarse) como un 500.
interface HttpLikeError {
  status: number;
  expose?: boolean;
  type?: string;
}

function isClientHttpError(err: unknown): err is HttpLikeError {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const { status, expose } = err as Partial<HttpLikeError>;
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}

const CLIENT_ERROR_CODES: Record<string, { code: string; message: string }> = {
  'entity.parse.failed': {
    code: 'INVALID_JSON',
    message: 'El cuerpo de la petición no es JSON válido',
  },
  'entity.too.large': {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'El cuerpo de la petición es demasiado grande',
  },
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (isClientHttpError(err)) {
    const known = (err.type && CLIENT_ERROR_CODES[err.type]) || {
      code: 'BAD_REQUEST',
      message: 'Petición inválida',
    };
    res.status(err.status).json({ error: known });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  // req.log (pino-http) lleva el id de la petición; logger como respaldo.
  (req.log ?? logger).error({ err }, 'Error no controlado');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
  });
};
