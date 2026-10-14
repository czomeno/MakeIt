import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const BOARD_TEMPLATES = ['generic', 'job-applications'] as const;
export type BoardTemplate = (typeof BOARD_TEMPLATES)[number];

export const BOARD_ROLES = ['admin', 'editor', 'viewer'] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: BOARD_ROLES, required: true },
  },
  { _id: false },
);

const boardSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    template: { type: String, enum: BOARD_TEMPLATES, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

// Para GET /api/boards (tableros del usuario) y comprobación de membresía.
boardSchema.index({ owner: 1 });
boardSchema.index({ 'members.user': 1 });

export type BoardDocument = HydratedDocument<InferSchemaType<typeof boardSchema>>;

export const Board = model('Board', boardSchema);
