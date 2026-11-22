import mongoose, { type InferSchemaType } from 'mongoose'
import { APPOINTMENT_STATUSES } from './sharedEnums.ts'

const { model, models, Schema } = mongoose

export const appointmentSchema = new Schema({
  appointmentId: { type: String, required: true, unique: true, trim: true, maxlength: 48 },
  citizen: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  status: { type: String, enum: APPOINTMENT_STATUSES, required: true, default: 'pending' },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  activeBookingKey: { type: String, select: false },
  statusHistory: [{
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 500 },
  }],
  rescheduleCount: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false })

appointmentSchema.index({ citizen: 1, appointmentDate: 1 })
appointmentSchema.index({ citizen: 1, department: 1, appointmentDate: 1, appointmentTime: 1, status: 1 })
appointmentSchema.index({ department: 1, appointmentDate: 1, status: 1 })
appointmentSchema.index({ activeBookingKey: 1 }, { unique: true, sparse: true })

appointmentSchema.pre('save', function () {
  if (['completed', 'cancelled'].includes(this.status)) this.activeBookingKey = undefined
})

appointmentSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as Record<string, unknown> | null
  if (!update || Array.isArray(update)) return
  const set = update.$set as Record<string, unknown> | undefined
  const status = set?.status ?? update.status
  if (status === 'completed' || status === 'cancelled') {
    update.$unset = { ...(update.$unset as Record<string, unknown> | undefined), activeBookingKey: 1 }
    if (set) delete set.activeBookingKey
    delete update.activeBookingKey
    this.setUpdate(update)
  }
})

export type Appointment = InferSchemaType<typeof appointmentSchema>
export const AppointmentModel = models.Appointment ?? model('Appointment', appointmentSchema)
