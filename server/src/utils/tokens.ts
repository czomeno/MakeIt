import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';

const accessPayloadSchema = z.object({ sub: z.string(), email: z.string(), name: z.string() });
const refreshPayloadSchema = z.object({ sub: z.string(), jti: z.string() });

export type AccessTokenPayload = z.infer<typeof accessPayloadSchema>;
export type RefreshTokenPayload = z.infer<typeof refreshPayloadSchema>;

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return accessPayloadSchema.parse(jwt.verify(token, env.JWT_ACCESS_SECRET));
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { token, jti };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return refreshPayloadSchema.parse(jwt.verify(token, env.JWT_REFRESH_SECRET));
}

// Lee el "exp" del propio token recién firmado, en vez de recalcular la
// duración por nuestra cuenta a partir de JWT_REFRESH_EXPIRES_IN.
export function getTokenExpiry(token: string): Date {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string' || typeof decoded.exp !== 'number') {
    throw new Error('No se pudo leer la expiración del token');
  }
  return new Date(decoded.exp * 1000);
}
