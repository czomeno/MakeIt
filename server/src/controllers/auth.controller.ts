import type { CookieOptions, RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';
import { getCookie } from '../utils/cookies.js';
import { getTokenExpiry } from '../utils/tokens.js';
import { requireUser } from '../utils/requestContext.js';

const REFRESH_COOKIE = 'refreshToken';

// - httpOnly: JavaScript no puede leerla (ni un XSS).
// - secure en producción: solo viaja por HTTPS.
// - sameSite strict: el cliente se sirve desde el mismo origen que la API, así
//   que el fetch de la propia página siempre la envía; ninguna otra web puede.
// - path /api/auth: solo la reciben refresh y logout.
// - expires: la del propio JWT. Sin ella sería una cookie de sesión, y iOS la
//   borra al cerrar la PWA (la sesión no sobreviviría a reabrir la app).
function refreshCookieOptions(refreshToken?: string): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    ...(refreshToken && { expires: getTokenExpiry(refreshToken) }),
  };
}

export const register: RequestHandler = async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(refreshToken));
  res.status(201).json({ user, accessToken });
};

export const login: RequestHandler = async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(refreshToken));
  res.status(200).json({ user, accessToken });
};

export const refresh: RequestHandler = async (req, res) => {
  const token = getCookie(req, REFRESH_COOKIE);
  const { accessToken, refreshToken } = await authService.refresh(token);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(refreshToken));
  res.status(200).json({ accessToken });
};

export const logout: RequestHandler = async (req, res) => {
  const token = getCookie(req, REFRESH_COOKIE);
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.status(204).send();
};

export const changePassword: RequestHandler = async (req, res) => {
  const authUser = requireUser(req);
  const { accessToken, refreshToken } = await authService.changePassword(authUser.id, req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(refreshToken));
  res.status(200).json({ accessToken });
};

export const me: RequestHandler = async (req, res) => {
  const authUser = requireUser(req);
  const user = await authService.getById(authUser.id);
  res.status(200).json({ user });
};
