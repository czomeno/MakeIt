import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { BOARD_ROLES } from './Board.js';

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

const invitationSchema = new Schema(
  {
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: BOARD_ROLES, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Nunca se guarda el token en claro, solo su hash (igual que RefreshToken).
    tokenHash: { type: String, required: true },
    status: { type: String, enum: INVITATION_STATUSES, default: 'pending' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Expiración por comprobación explícita (no TTL): si Mongo borrara el
// documento al caducar, quien pulse un enlace viejo vería "no encontrada"
// en vez de "ha caducado". invitations.service marca `status: 'expired'`
// de forma perezosa al leer/aceptar.
invitationSchema.index(
  { board: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

export type InvitationDocument = HydratedDocument<InferSchemaType<typeof invitationSchema>>;

export const Invitation = model('Invitation', invitationSchema);
