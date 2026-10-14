import type { Request } from 'express';

// cookie-parser tipa req.cookies de forma laxa; esto evita que ese "any" se filtre.
export function getCookie(req: Request, name: string): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : undefined;
}
