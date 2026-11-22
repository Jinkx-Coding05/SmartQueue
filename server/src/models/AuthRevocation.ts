import mongoose, { type InferSchemaType } from 'mongoose'

const { model, models, Schema } = mongoose

export const authRevocationSchema = new Schema({
  tokenId: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false })

authRevocationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type AuthRevocation = InferSchemaType<typeof authRevocationSchema>
export const AuthRevocationModel = models.AuthRevocation ?? model('AuthRevocation', authRevocationSchema)
