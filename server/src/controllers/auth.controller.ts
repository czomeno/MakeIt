import type { CookieOptions, RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';
import { env } from '../config/env.js';
import { getCookie } from '../utils/cookies.js';
import { requireUser } from '../utils/requestContext.js';

const REFRESH_COOKIE = 'refreshToken';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  };
}

export const register: RequestHandler = async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.status(201).json({ user, accessToken });
};

export const login: RequestHandler = async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.status(200).json({ user, accessToken });
};

export const refresh: RequestHandler = async (req, res) => {
  const token = getCookie(req, REFRESH_COOKIE);
  const { accessToken, refreshToken } = await authService.refresh(token);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.status(200).json({ accessToken });
};

export const logout: RequestHandler = async (req, res) => {
  const token = getCookie(req, REFRESH_COOKIE);
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).send();
};

export const me: RequestHandler = async (req, res) => {
  const authUser = requireUser(req);
  const user = await authService.getById(authUser.id);
  res.status(200).json({ user });
};
