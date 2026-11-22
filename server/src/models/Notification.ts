import mongoose, { type InferSchemaType } from 'mongoose'
import { NOTIFICATION_TYPES } from './sharedEnums.ts'

const { model, models, Schema } = mongoose

export const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
  message: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  isRead: { type: Boolean, required: true, default: false },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 })

export type Notification = InferSchemaType<typeof notificationSchema>
export const NotificationModel = models.Notification ?? model('Notification', notificationSchema)
