import mongoose, { type InferSchemaType } from 'mongoose'
import { ACCOUNT_STATUSES, USER_ROLES } from './sharedEnums.ts'

const { model, models, Schema } = mongoose

const addressSchema = new Schema({
  address: { type: String, trim: true, maxlength: 300 },
  city: { type: String, trim: true, maxlength: 100 },
  state: { type: String, trim: true, maxlength: 100 },
  pinCode: { type: String, trim: true, maxlength: 12 },
}, { _id: false })

const adminNotificationPreferencesSchema = new Schema({
  newAppointments: { type: Boolean, default: true },
  cancellations: { type: Boolean, default: true },
  delays: { type: Boolean, default: true },
  dailySummary: { type: Boolean, default: false },
}, { _id: false })

export const userSchema = new Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  phoneNumber: { type: String, required: true, unique: true, trim: true, maxlength: 24 },
  // Password hashes are never returned by default.
  passwordHash: { type: String, required: true, select: false, minlength: 20 },
  passwordChangedAt: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  role: { type: String, enum: USER_ROLES, required: true, default: 'citizen' },
  testAccount: { type: Boolean, default: false, select: false },
  demoSeedKey: { type: String, trim: true, select: false },
  emailVerified: { type: Boolean, required: true, default: false },
  verificationCodeHash: { type: String, select: false },
  verificationCodeExpiresAt: { type: Date, select: false },
  verificationCodeIssuedAt: { type: Date, select: false },
  verificationCodeAttempts: { type: Number, default: 0, min: 0, max: 10, select: false },
  passwordResetIssuedAt: { type: Date, select: false },
  dateOfBirth: { type: Date },
  gender: { type: String, trim: true, maxlength: 40 },
  address: { type: addressSchema, default: undefined },
  profileImage: { type: String, trim: true, maxlength: 2048 },
  adminNotificationPreferences: { type: adminNotificationPreferencesSchema, default: () => ({}) },
  accountStatus: { type: String, enum: ACCOUNT_STATUSES, required: true, default: 'active' },
}, { timestamps: true, versionKey: false })

userSchema.index({ role: 1, accountStatus: 1 })
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true })
userSchema.index({ emailVerified: 1, accountStatus: 1 })
userSchema.index({ demoSeedKey: 1 }, { unique: true, sparse: true })

export type User = InferSchemaType<typeof userSchema>
export const UserModel = models.User ?? model('User', userSchema)
