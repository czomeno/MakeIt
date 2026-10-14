import { randomBytes } from 'node:crypto';
import { Board, type BoardRole } from '../models/Board.js';
import { User } from '../models/User.js';
import { Invitation, type InvitationDocument } from '../models/Invitation.js';
import { AppError } from '../errors/AppError.js';
import { hashToken } from '../utils/hash.js';
import { publish } from './events.service.js';
import { mailer } from '../mailer/Mailer.js';
import { env } from '../config/env.js';
import type { CreateInvitationInput } from '../schemas/invitations.schema.js';

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}

const ROLE_LABELS: Record<BoardRole, string> = {
  admin: 'administrador',
  editor: 'editor',
  viewer: 'lector',
};

function toPublicInvitation(invitation: {
  _id: unknown;
  email: string;
  role: BoardRole;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: String(invitation._id),
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

export async function create(boardId: string, input: CreateInvitationInput, actorId: string) {
  const board = await Board.findById(boardId).select('title').lean();
  if (!board) {
    throw AppError.notFound('Tablero no encontrado');
  }
  const actor = await User.findById(actorId).select('name').lean();

  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  let invitation: InvitationDocument;
  try {
    invitation = await Invitation.create({
      board: boardId,
      email: input.email,
      role: input.role,
      invitedBy: actorId,
      tokenHash: hashToken(rawToken),
      status: 'pending',
      expiresAt,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw AppError.conflict('Ya hay una invitación pendiente para ese email en este tablero');
    }
    throw error;
  }

  const link = `${env.APP_BASE_URL}/invite/${rawToken}`;
  const inviterName = actor?.name ?? 'Alguien';
  await mailer.send({
    to: input.email,
    subject: `${inviterName} te ha invitado al tablero «${board.title}» en ${env.APP_NAME}`,
    body: [
      `Hola,`,
      ``,
      `${inviterName} te ha invitado a colaborar en el tablero "${board.title}" en ${env.APP_NAME} como ${ROLE_LABELS[input.role]}.`,
      ``,
      `Acepta la invitación aquí:`,
      link,
      ``,
      `Este enlace caduca en ${env.INVITATION_EXPIRES_DAYS} días.`,
      ``,
      `— El equipo de ${env.APP_NAME}`,
    ].join('\n'),
  });

  return { invitation: toPublicInvitation(invitation), link };
}

export async function listPending(boardId: string) {
  const invitations = await Invitation.find({
    board: boardId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
  return invitations.map(toPublicInvitation);
}

export async function revoke(invitationId: string): Promise<void> {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation || invitation.status !== 'pending') {
    throw AppError.notFound('Invitación no encontrada');
  }
  invitation.status = 'revoked';
  await invitation.save();
}

export async function accept(
  token: string,
  userId: string,
  userEmail: string,
): Promise<{ boardId: string }> {
  const invitation = await Invitation.findOne({ tokenHash: hashToken(token) });
  if (!invitation) {
    throw AppError.notFound('Esta invitación no es válida');
  }

  if (invitation.status === 'revoked') {
    throw AppError.conflict('Esta invitación ha sido revocada');
  }

  if (invitation.status === 'pending' && invitation.expiresAt.getTime() < Date.now()) {
    invitation.status = 'expired';
    await invitation.save();
  }

  if (invitation.status === 'expired') {
    throw AppError.conflict('Esta invitación ha caducado');
  }

  // No revela si otro email tiene cuenta: solo compara con el email del
  // usuario ya autenticado que está intentando aceptar.
  if (invitation.email !== userEmail.toLowerCase()) {
    throw AppError.forbidden('Esta invitación no corresponde a tu cuenta');
  }

  const board = await Board.findById(invitation.board);
  if (!board) {
    throw AppError.notFound('El tablero de esta invitación ya no existe');
  }

  const alreadyMember = board.members.some((member) => member.user.toString() === userId);
  if (!alreadyMember) {
    board.members.push({ user: userId, role: invitation.role });
    await board.save();

    const user = await User.findById(userId).select('name email').lean();
    await publish({
      board: invitation.board.toString(),
      activity: {
        actor: userId,
        type: 'member.joined',
        data: { memberName: user?.name ?? '' },
      },
      socket: {
        event: 'member:joined',
        payload: {
          member: { userId, role: invitation.role, name: user?.name, email: user?.email },
          actorId: userId,
        },
      },
    });
  }

  if (invitation.status !== 'accepted') {
    invitation.status = 'accepted';
    await invitation.save();
  }

  return { boardId: invitation.board.toString() };
}
