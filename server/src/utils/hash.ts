import { createHash } from 'node:crypto';

// Para el refresh token: alta entropía, no una contraseña de usuario, así
// que un hash rápido (sha256) basta y evita el coste de bcrypt en cada request.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
