import mongoose, { type InferSchemaType } from 'mongoose'

const { model, models, Schema } = mongoose

const settingHoursSchema = new Schema({
  day: { type: String, required: true, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
  opensAt: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  closesAt: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  isClosed: { type: Boolean, default: false },
}, { _id: false })

export const hospitalSettingsSchema = new Schema({
  singleton: { type: String, required: true, unique: true, default: 'global' },
  hospitalName: { type: String, trim: true, maxlength: 160, default: 'SmartQueue Demo Hospital' },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  contactNumber: { type: String, trim: true, maxlength: 24, default: '' },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  workingHours: { type: [settingHoursSchema], default: [] },
  tokenPrefix: { type: String, trim: true, uppercase: true, minlength: 1, maxlength: 8, default: 'SQ' },
  maxDailyTokens: { type: Number, min: 1, max: 10000, default: 500 },
  priorityQueueEnabled: { type: Boolean, default: true },
  showEstimatedWaitingTime: { type: Boolean, default: true },
  autoCallNext: { type: Boolean, default: false },
  sessionTimeoutMinutes: { type: Number, min: 5, max: 1440, default: 30 },
}, { timestamps: true, versionKey: false })

export type HospitalSettings = InferSchemaType<typeof hospitalSettingsSchema>
export const HospitalSettingsModel = models.HospitalSettings ?? model('HospitalSettings', hospitalSettingsSchema)
