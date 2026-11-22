import mongoose, { type InferSchemaType } from 'mongoose'

const { model, models, Schema } = mongoose

export const adminActivitySchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  entityType: { type: String, required: true, enum: ['token', 'counter', 'appointment', 'department', 'settings', 'queue', 'profile'] },
  entityId: { type: String, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  metadata: { type: Schema.Types.Mixed, default: undefined },
  demoSeedKey: { type: String, trim: true, select: false },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })

adminActivitySchema.index({ createdAt: -1 })
adminActivitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 })

export type AdminActivity = InferSchemaType<typeof adminActivitySchema>
export const AdminActivityModel = models.AdminActivity ?? model('AdminActivity', adminActivitySchema)
