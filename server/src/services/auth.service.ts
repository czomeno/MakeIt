import { User, type UserDocument } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { hashToken } from '../utils/hash.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getTokenExpiry,
} from '../utils/tokens.js';
import { AppError } from '../errors/AppError.js';
import type { RegisterInput, LoginInput, ChangePasswordInput } from '../schemas/auth.schema.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}

async function issueSession(
  user: UserDocument,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    name: user.name,
  });
  const { token: refreshToken, jti } = signRefreshToken(user._id.toString());
  const expiresAt = getTokenExpiry(refreshToken);

  await RefreshToken.create({ user: user._id, jti, tokenHash: hashToken(refreshToken), expiresAt });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<Session> {
  const passwordHash = await hashPassword(input.password);

  let user: UserDocument;
  try {
    user = await User.create({ name: input.name, email: input.email, passwordHash });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw AppError.conflict('Ya existe una cuenta con ese email');
    }
    throw error;
  }

  const { accessToken, refreshToken } = await issueSession(user);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function login(input: LoginInput): Promise<Session> {
  const user = await User.findOne({ email: input.email });
  if (!user) {
    throw AppError.unauthorized('Credenciales inválidas');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('Credenciales inválidas');
  }

  const { accessToken, refreshToken } = await issueSession(user);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function refresh(
  token: string | undefined,
): Promise<{ accessToken: string; refreshToken: string }> {
  if (!token) {
    throw AppError.unauthorized('Falta el refresh token');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw AppError.unauthorized('Refresh token inválido');
  }

  const stored = await RefreshToken.findOne({ jti: payload.jti });
  if (!stored || stored.tokenHash !== hashToken(token)) {
    throw AppError.unauthorized('Refresh token inválido');
  }

  // Rotación: el token usado se invalida aunque la petición falle después.
  await RefreshToken.deleteOne({ _id: stored._id });

  const user = await User.findById(payload.sub);
  if (!user) {
    throw AppError.unauthorized('Usuario no encontrado');
  }

  return issueSession(user);
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) {
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    await RefreshToken.deleteOne({ jti: payload.jti });
  } catch {
    // Token ya inválido o caducado: no hay nada que revocar.
  }
}

// Cambia la contraseña y cierra todas las sesiones del usuario (las de otros
// dispositivos incluidas). Devuelve una sesión nueva para que el dispositivo
// que hizo el cambio siga conectado. Una contraseña actual incorrecta es un
// 400 y no un 401: el cliente trata el 401 como sesión caducada.
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await User.findById(userId);
  if (!user) {
    throw AppError.unauthorized('Usuario no encontrado');
  }

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw AppError.badRequest('La contraseña actual no es correcta');
  }

  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });

  return issueSession(user);
}

export async function getById(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw AppError.notFound('Usuario no encontrado');
  }
  return toPublicUser(user);
}
