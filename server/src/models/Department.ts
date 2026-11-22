import mongoose, { type InferSchemaType } from 'mongoose'

const { model, models, Schema } = mongoose

const workingHoursSchema = new Schema({
  day: { type: String, required: true, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
  opensAt: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  closesAt: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  isClosed: { type: Boolean, default: false },
}, { _id: false })

const departmentQueueSettingsSchema = new Schema({
  maxDailyTokens: { type: Number, min: 1, max: 10000 },
  priorityEnabled: { type: Boolean, default: true },
  showEstimatedWaitingTime: { type: Boolean, default: true },
  autoCallNext: { type: Boolean, default: false },
}, { _id: false })

export const departmentSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  isActive: { type: Boolean, required: true, default: true },
  workingHours: { type: [workingHoursSchema], default: [] },
  queueSettings: { type: departmentQueueSettingsSchema, default: undefined },
}, { timestamps: true, versionKey: false })

departmentSchema.index({ isActive: 1, name: 1 })

export type Department = InferSchemaType<typeof departmentSchema>
export const DepartmentModel = models.Department ?? model('Department', departmentSchema)
