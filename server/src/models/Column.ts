import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const columnSchema = new Schema(
  {
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    title: { type: String, required: true, trim: true },
    position: { type: Number, required: true },
  },
  { timestamps: true },
);

// Consulta típica: columnas de un tablero, en orden.
columnSchema.index({ board: 1, position: 1 });

export type ColumnDocument = HydratedDocument<InferSchemaType<typeof columnSchema>>;

export const Column = model('Column', columnSchema);
