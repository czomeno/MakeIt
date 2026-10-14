import type { RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';
import { AppError } from '../errors/AppError.js';

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

// req.params/req.query son getters en Express 5; se mutan en vez de reasignarse.
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        Object.assign(req.params, schemas.params.parse(req.params));
      }
      if (schemas.query) {
        Object.assign(req.query, schemas.query.parse(req.query));
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError(400, 'VALIDATION_ERROR', 'Datos de entrada inválidos', error.flatten()));
        return;
      }
      next(error);
    }
  };
}
