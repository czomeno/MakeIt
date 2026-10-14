import type { RequestHandler } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    // Id opcional que manda el cliente en cada mutación (cabecera
    // X-Mutation-Id, no el body: es metadato de transporte, no de dominio),
    // para que pueda ignorar el eco de sus propios cambios por socket sin
    // depender solo de compararse por actorId (lo que fallaría con dos
    // pestañas abiertas del mismo usuario).
    mutationId?: string;
  }
}

export const captureMutationId: RequestHandler = (req, _res, next) => {
  const header = req.header('x-mutation-id');
  req.mutationId = typeof header === 'string' && header.length > 0 ? header : undefined;
  next();
};
