import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const ACTIVITY_TYPES = [
  'card.created',
  'card.updated',
  'card.moved',
  'card.deleted',
  'column.created',
  'column.renamed',
  'column.moved',
  'column.deleted',
  'member.joined',
  'member.left',
  'member.removed',
  'member.role_changed',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const activitySchema = new Schema(
  {
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    card: { type: Schema.Types.ObjectId, ref: 'Card' },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    // Títulos/nombres en el momento del evento, no referencias: el historial
    // sigue teniendo sentido aunque la tarjeta/columna se borre o renombre.
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ board: 1, createdAt: -1 });
activitySchema.index({ card: 1, createdAt: -1 });
// Retención: 180 días, mismo patrón TTL que RefreshToken.ts.
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });

export type ActivityDocument = HydratedDocument<InferSchemaType<typeof activitySchema>>;

export const Activity = model('Activity', activitySchema);
