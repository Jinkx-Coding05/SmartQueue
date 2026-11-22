import mongoose, { type InferSchemaType } from 'mongoose'
import { COUNTER_STATUSES } from './sharedEnums.ts'

const { model, models, Schema } = mongoose

export const counterSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  counterNumber: { type: String, required: true, unique: true, trim: true, maxlength: 32 },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  status: { type: String, enum: COUNTER_STATUSES, required: true, default: 'inactive' },
  currentServingToken: { type: String, trim: true, maxlength: 40, default: null },
  currentServingTokenId: { type: Schema.Types.ObjectId, ref: 'Token', default: null },
  demoSeedKey: { type: String, trim: true, select: false },
}, { timestamps: true, versionKey: false })

counterSchema.index({ department: 1, status: 1 })
counterSchema.index({ demoSeedKey: 1 }, { unique: true, sparse: true })

export type Counter = InferSchemaType<typeof counterSchema>
export const CounterModel = models.Counter ?? model('Counter', counterSchema)
