import mongoose, { type InferSchemaType } from 'mongoose'
import { TOKEN_PRIORITIES, TOKEN_STATUSES } from './sharedEnums.ts'

const { model, models, Schema } = mongoose

export const tokenSchema = new Schema({
  tokenNumber: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
  citizen: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  counter: { type: Schema.Types.ObjectId, ref: 'Counter', default: null },
  priority: { type: String, enum: TOKEN_PRIORITIES, required: true, default: 'normal' },
  status: { type: String, enum: TOKEN_STATUSES, required: true, default: 'waiting' },
  bookingDate: { type: Date, required: true, default: Date.now },
  preferredVisitDate: { type: Date },
  preferredTime: { type: String, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  visitType: { type: String, enum: ['New Consultation', 'Follow-up', 'Emergency'] },
  activePreferenceKey: { type: String, select: false },
  estimatedWaitingTime: { type: Number, required: true, min: 0, default: 0 },
  activeBookingKey: { type: String, select: false },
  calledAt: { type: Date },
  servingAt: { type: Date },
  completedAt: { type: Date },
  skippedAt: { type: Date },
  cancelledAt: { type: Date },
  callCount: { type: Number, min: 0, default: 0 },
  demoSeedKey: { type: String, trim: true, select: false },
}, { timestamps: true, versionKey: false })

tokenSchema.index({ citizen: 1, bookingDate: -1 })
tokenSchema.index({ citizen: 1, department: 1, status: 1, bookingDate: 1 })
tokenSchema.index({ department: 1, status: 1, bookingDate: 1 })
tokenSchema.index({ counter: 1, status: 1 })
tokenSchema.index({ activeBookingKey: 1 }, { unique: true, sparse: true })
tokenSchema.index({ activePreferenceKey: 1 }, { unique: true, sparse: true })
tokenSchema.index({ department: 1, status: 1, servingAt: 1 })
tokenSchema.index({ demoSeedKey: 1 }, { unique: true, sparse: true })

tokenSchema.pre('save', function () {
  if (['completed', 'skipped', 'cancelled'].includes(this.status)) { this.activeBookingKey = undefined; this.activePreferenceKey = undefined }
})

tokenSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as Record<string, unknown> | null
  if (!update || Array.isArray(update)) return
  const set = update.$set as Record<string, unknown> | undefined
  const status = set?.status ?? update.status
  if (typeof status === 'string' && ['completed', 'skipped', 'cancelled'].includes(status)) {
    update.$unset = { ...(update.$unset as Record<string, unknown> | undefined), activeBookingKey: 1, activePreferenceKey: 1 }
    if (set) { delete set.activeBookingKey; delete set.activePreferenceKey }
    delete update.activeBookingKey
    delete update.activePreferenceKey
    this.setUpdate(update)
  }
})

export type Token = InferSchemaType<typeof tokenSchema>
export const TokenModel = models.Token ?? model('Token', tokenSchema)
