import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const CARD_PRIORITIES = ['low', 'medium', 'high'] as const;
export type CardPriority = (typeof CARD_PRIORITIES)[number];

const cardSchema = new Schema(
  {
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    column: { type: Schema.Types.ObjectId, ref: 'Column', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    position: { type: Number, required: true },
    labels: { type: [String], default: [] },
    dueDate: { type: Date },
    assignees: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    priority: { type: String, enum: CARD_PRIORITIES },
    completed: { type: Boolean, default: false },
    // Campos opcionales para el template "job-applications".
    company: { type: String, trim: true },
    jobUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

// Consulta típica: tarjetas de una columna, en orden.
cardSchema.index({ column: 1, position: 1 });

export type CardDocument = HydratedDocument<InferSchemaType<typeof cardSchema>>;

export const Card = model('Card', cardSchema);
