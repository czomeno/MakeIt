import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { AppError } from '../errors/AppError.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    next(AppError.unauthorized());
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    next(AppError.unauthorized('Token inválido o caducado'));
  }
};
