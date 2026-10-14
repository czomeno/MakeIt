import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

// Una fila por sesión activa; nunca se guarda el token en claro, solo su hash.
const refreshTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jti: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// TTL: Mongo borra el documento solo al llegar expiresAt.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDocument = HydratedDocument<InferSchemaType<typeof refreshTokenSchema>>;

export const RefreshToken = model('RefreshToken', refreshTokenSchema);
