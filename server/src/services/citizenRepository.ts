import { Types } from 'mongoose'
import { AppointmentModel } from '../models/Appointment.ts'
import { CounterModel } from '../models/Counter.ts'
import { DepartmentModel } from '../models/Department.ts'
import { DocumentModel } from '../models/Document.ts'
import { NotificationModel } from '../models/Notification.ts'
import { TokenModel } from '../models/Token.ts'
import { UserModel } from '../models/User.ts'
import type { AppointmentStatus, TokenStatus } from '../models/sharedEnums.ts'
import type { ProfilePatch, CreateDocumentInput } from './citizenValidation.ts'

export type ProfileRecord = {
  id: string; fullName: string; email: string; phoneNumber: string; dateOfBirth?: Date; gender?: string; profileImage?: string
  address?: { address?: string; city?: string; state?: string; pinCode?: string }; accountStatus: string; createdAt: Date
}
export type DepartmentRecord = {
  id: string; name: string; description: string; workingHours: Array<{ day: string; opensAt: string; closesAt: string; isClosed: boolean }>
  activeCounterCount: number; available: boolean
}
export type TokenRecord = {
  id: string; tokenNumber: string; departmentId: string; departmentName: string; counterId?: string; counterName?: string
  status: TokenStatus; bookingDate: Date; estimatedWaitingTime: number; preferredVisitDate?: Date; preferredTime?: string; visitType?: string; createdAt: Date; updatedAt: Date
}
export type AppointmentRecord = {
  id: string; appointmentId: string; departmentId: string; departmentName: string; appointmentDate: Date; appointmentTime: string
  status: AppointmentStatus; notes: string; createdAt: Date; updatedAt: Date
}
export type DocumentRecord = {
  id: string; documentType: string; fileMetadata: CreateDocumentInput['fileMetadata'] & { storageProvider?: string; storageKey?: string }
  verificationStatus: string; storageStatus: 'metadata-only' | 'stored'; uploadDate: Date
}
export type NotificationRecord = { id: string; title: string; message: string; type: string; isRead: boolean; createdAt: Date }
export type PageResult<T> = { items: T[]; total: number }
export type AppointmentUpdate = { appointmentDate?: Date; appointmentTime?: string; notes?: string; status: AppointmentStatus; activeBookingKey: string }

export interface CitizenRepository {
  getProfile(userId: string): Promise<ProfileRecord | null>
  updateProfile(userId: string, patch: ProfilePatch): Promise<ProfileRecord | null>
  listActiveDepartments(): Promise<DepartmentRecord[]>
  getActiveDepartment(id: string): Promise<DepartmentRecord | null>
  findActiveToken(userId: string, departmentId: string, start: Date, end: Date): Promise<TokenRecord | null>
  hasActivePreferenceKey(key: string): Promise<boolean>
  getQueueWaitEstimate(departmentId: string, start: Date, end: Date): Promise<number>
  createToken(input: { tokenNumber: string; userId: string; departmentId: string; bookingDate: Date; estimatedWaitingTime: number; activeBookingKey: string; preferredVisitDate?: Date; preferredTime?: string; visitType?: string; activePreferenceKey?: string; demoSeedKey?: string }): Promise<TokenRecord>
  getOwnedToken(userId: string, tokenId: string): Promise<TokenRecord | null>
  listOwnedTokens(userId: string, skip: number, limit: number): Promise<PageResult<TokenRecord>>
  countWaitingAhead(departmentId: string, bookingDate: Date, tokenId: string, dayStart: Date, dayEnd: Date): Promise<number>
  getCurrentlyServing(departmentId: string, start: Date, end: Date): Promise<{ tokenNumber: string; counterName?: string } | null>
  cancelOwnedToken(userId: string, tokenId: string): Promise<TokenRecord | null>
  findDuplicateAppointment(userId: string, departmentId: string, date: Date, time: string, excludeId?: string): Promise<boolean>
  createAppointment(input: { appointmentId: string; userId: string; departmentId: string; appointmentDate: Date; appointmentTime: string; notes: string; activeBookingKey: string }): Promise<AppointmentRecord>
  getOwnedAppointment(userId: string, appointmentId: string): Promise<AppointmentRecord | null>
  listOwnedAppointments(userId: string, skip: number, limit: number): Promise<PageResult<AppointmentRecord>>
  updateOwnedAppointment(userId: string, id: string, input: AppointmentUpdate): Promise<AppointmentRecord | null>
  cancelOwnedAppointment(userId: string, id: string): Promise<AppointmentRecord | null>
  createDocument(userId: string, input: CreateDocumentInput): Promise<DocumentRecord>
  listOwnedDocuments(userId: string, skip: number, limit: number): Promise<PageResult<DocumentRecord>>
  deleteOwnedDocument(userId: string, id: string): Promise<boolean>
  listNotifications(userId: string, skip: number, limit: number, unreadOnly: boolean): Promise<PageResult<NotificationRecord>>
  markNotificationRead(userId: string, id: string): Promise<NotificationRecord | null>
  markAllNotificationsRead(userId: string): Promise<number>
}

type IdRecord = { _id: Types.ObjectId }
type ProfileSource = IdRecord & Omit<ProfileRecord, 'id'>
type DepartmentSource = IdRecord & Omit<DepartmentRecord, 'id' | 'activeCounterCount' | 'available'> & { isActive: boolean }
type TokenSource = IdRecord & {
  tokenNumber: string; department: Types.ObjectId | { _id: Types.ObjectId; name: string }; counter?: Types.ObjectId | { _id: Types.ObjectId; name: string; counterNumber: string } | null
  status: TokenStatus; bookingDate: Date; estimatedWaitingTime: number; preferredVisitDate?: Date; preferredTime?: string; visitType?: string; createdAt: Date; updatedAt: Date
}
type AppointmentSource = IdRecord & {
  appointmentId: string; department: Types.ObjectId | { _id: Types.ObjectId; name: string }; appointmentDate: Date; appointmentTime: string
  status: AppointmentStatus; notes: string; createdAt: Date; updatedAt: Date
}

const ACTIVE_TOKEN_STATUSES: TokenStatus[] = ['waiting', 'serving']
const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ['pending', 'approved', 'rescheduled']

function objectId(id: string) { return new Types.ObjectId(id) }
function entityId(entity: Types.ObjectId | { _id: Types.ObjectId }) { return entity instanceof Types.ObjectId ? entity.toString() : entity._id.toString() }
function departmentName(entity: Types.ObjectId | { _id: Types.ObjectId; name: string }) { return entity instanceof Types.ObjectId ? '' : entity.name }
function profileRecord(source: ProfileSource): ProfileRecord { return { ...source, id: source._id.toString() } }
function departmentRecord(source: DepartmentSource, activeCounterCount: number): DepartmentRecord {
  return { ...source, id: source._id.toString(), activeCounterCount, available: source.isActive && activeCounterCount > 0 }
}
function tokenRecord(source: TokenSource): TokenRecord {
  const counter = source.counter && !(source.counter instanceof Types.ObjectId) ? source.counter : null
  return {
    id: source._id.toString(), tokenNumber: source.tokenNumber, departmentId: entityId(source.department), departmentName: departmentName(source.department),
    ...(counter ? { counterId: counter._id.toString(), counterName: counter.name } : {}), status: source.status,
    bookingDate: source.bookingDate, estimatedWaitingTime: source.estimatedWaitingTime,
    ...(source.preferredVisitDate ? { preferredVisitDate: source.preferredVisitDate } : {}), ...(source.preferredTime ? { preferredTime: source.preferredTime } : {}), ...(source.visitType ? { visitType: source.visitType } : {}),
    createdAt: source.createdAt, updatedAt: source.updatedAt,
  }
}
function appointmentRecord(source: AppointmentSource): AppointmentRecord {
  return {
    id: source._id.toString(), appointmentId: source.appointmentId, departmentId: entityId(source.department), departmentName: departmentName(source.department),
    appointmentDate: source.appointmentDate, appointmentTime: source.appointmentTime, status: source.status, notes: source.notes,
    createdAt: source.createdAt, updatedAt: source.updatedAt,
  }
}

export const mongooseCitizenRepository: CitizenRepository = {
  async getProfile(userId) {
    const result = await UserModel.findById(userId).select('fullName email phoneNumber dateOfBirth gender profileImage address accountStatus createdAt').lean().exec()
    return result ? profileRecord(result as unknown as ProfileSource) : null
  },
  async updateProfile(userId, patch) {
    const update: Record<string, unknown> = {}
    const { address, ...fields } = patch
    Object.assign(update, fields)
    for (const [key, value] of Object.entries(address ?? {})) update[`address.${key}`] = value
    const result = await UserModel.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true })
      .select('fullName email phoneNumber dateOfBirth gender profileImage address accountStatus createdAt').lean().exec()
    return result ? profileRecord(result as unknown as ProfileSource) : null
  },
  async listActiveDepartments() {
    const rows = await DepartmentModel.find({ isActive: true }).sort({ name: 1 }).lean().exec()
    if (!rows.length) return []
    const ids = rows.map((row) => row._id)
    const counts = await CounterModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { department: { $in: ids }, status: { $in: ['active', 'available', 'busy'] } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ]).exec()
    const countById = new Map(counts.map((row) => [row._id.toString(), row.count]))
    return rows.map((row) => departmentRecord(row as unknown as DepartmentSource, countById.get(row._id.toString()) ?? 0))
  },
  async getActiveDepartment(id) {
    const row = await DepartmentModel.findOne({ _id: objectId(id), isActive: true }).lean().exec()
    if (!row) return null
    const activeCounterCount = await CounterModel.countDocuments({ department: row._id, status: { $in: ['active', 'available', 'busy'] } }).exec()
    return departmentRecord(row as unknown as DepartmentSource, activeCounterCount)
  },
  async findActiveToken(userId, departmentId, start, end) {
    const row = await TokenModel.findOne({ citizen: userId, department: departmentId, status: { $in: ACTIVE_TOKEN_STATUSES }, bookingDate: { $gte: start, $lt: end } })
      .populate('department', 'name').populate('counter', 'name counterNumber').lean().exec()
    return row ? tokenRecord(row as unknown as TokenSource) : null
  },
  async hasActivePreferenceKey(key) { return Boolean(await TokenModel.exists({ activePreferenceKey: key })) },
  async getQueueWaitEstimate(departmentId, start, end) {
    const [result] = await TokenModel.aggregate<{ estimate: number }>([
      { $match: { department: objectId(departmentId), status: { $in: ACTIVE_TOKEN_STATUSES }, bookingDate: { $gte: start, $lt: end } } },
      { $group: { _id: null, estimate: { $avg: '$estimatedWaitingTime' } } },
    ]).exec()
    return Math.ceil(result?.estimate ?? 0)
  },
  async createToken(input) {
    const row = await new TokenModel({ tokenNumber: input.tokenNumber, citizen: input.userId, department: input.departmentId, bookingDate: input.bookingDate, estimatedWaitingTime: input.estimatedWaitingTime, activeBookingKey: input.activeBookingKey, ...(input.preferredVisitDate ? { preferredVisitDate: input.preferredVisitDate } : {}), ...(input.preferredTime ? { preferredTime: input.preferredTime } : {}), ...(input.visitType ? { visitType: input.visitType } : {}), ...(input.activePreferenceKey ? { activePreferenceKey: input.activePreferenceKey } : {}), ...(input.demoSeedKey ? { demoSeedKey: input.demoSeedKey } : {}) }).save()
    await row.populate('department', 'name')
    return tokenRecord(row.toObject() as unknown as TokenSource)
  },
  async getOwnedToken(userId, tokenId) {
    const row = await TokenModel.findOne({ _id: objectId(tokenId), citizen: userId }).populate('department', 'name').populate('counter', 'name counterNumber').lean().exec()
    return row ? tokenRecord(row as unknown as TokenSource) : null
  },
  async listOwnedTokens(userId, skip, limit) {
    const filter = { citizen: userId }
    const [rows, total] = await Promise.all([
      TokenModel.find(filter).sort({ bookingDate: -1 }).skip(skip).limit(limit).populate('department', 'name').populate('counter', 'name counterNumber').lean().exec(),
      TokenModel.countDocuments(filter).exec(),
    ])
    return { items: rows.map((row) => tokenRecord(row as unknown as TokenSource)), total }
  },
  async countWaitingAhead(departmentId, bookingDate, tokenId, dayStart, dayEnd) {
    const id = objectId(tokenId)
    return TokenModel.countDocuments({
      department: departmentId, status: 'waiting', bookingDate: { $gte: dayStart, $lt: dayEnd },
      $or: [{ bookingDate: { $lt: bookingDate } }, { bookingDate, _id: { $lt: id } }],
    }).exec()
  },
  async getCurrentlyServing(departmentId, start, end) {
    const row = await TokenModel.findOne({ department: departmentId, status: 'serving', bookingDate: { $gte: start, $lt: end } })
      .sort({ bookingDate: 1 }).populate('counter', 'name counterNumber').lean().exec()
    if (!row) return null
    const token = row as unknown as TokenSource
    const counter = token.counter && !(token.counter instanceof Types.ObjectId) ? token.counter.name : undefined
    return { tokenNumber: token.tokenNumber, ...(counter ? { counterName: counter } : {}) }
  },
  async cancelOwnedToken(userId, tokenId) {
    const row = await TokenModel.findOneAndUpdate({ _id: objectId(tokenId), citizen: userId, status: 'waiting' }, { $set: { status: 'cancelled' }, $unset: { activeBookingKey: 1 } }, { new: true })
      .populate('department', 'name').populate('counter', 'name counterNumber').lean().exec()
    return row ? tokenRecord(row as unknown as TokenSource) : null
  },
  async findDuplicateAppointment(userId, departmentId, date, time, excludeId) {
    return Boolean(await AppointmentModel.exists({
      citizen: userId, department: departmentId, appointmentDate: date, appointmentTime: time,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES }, ...(excludeId ? { _id: { $ne: objectId(excludeId) } } : {}),
    }))
  },
  async createAppointment(input) {
    const row = await new AppointmentModel({
      appointmentId: input.appointmentId, citizen: input.userId, department: input.departmentId,
      appointmentDate: input.appointmentDate, appointmentTime: input.appointmentTime, notes: input.notes, activeBookingKey: input.activeBookingKey,
    }).save()
    await row.populate('department', 'name')
    return appointmentRecord(row.toObject() as unknown as AppointmentSource)
  },
  async getOwnedAppointment(userId, id) {
    const row = await AppointmentModel.findOne({ _id: objectId(id), citizen: userId }).populate('department', 'name').lean().exec()
    return row ? appointmentRecord(row as unknown as AppointmentSource) : null
  },
  async listOwnedAppointments(userId, skip, limit) {
    const filter = { citizen: userId }
    const [rows, total] = await Promise.all([
      AppointmentModel.find(filter).sort({ appointmentDate: -1, appointmentTime: -1 }).skip(skip).limit(limit).populate('department', 'name').lean().exec(),
      AppointmentModel.countDocuments(filter).exec(),
    ])
    return { items: rows.map((row) => appointmentRecord(row as unknown as AppointmentSource)), total }
  },
  async updateOwnedAppointment(userId, id, input) {
    const { status, ...fields } = input
    const row = await AppointmentModel.findOneAndUpdate(
      { _id: objectId(id), citizen: userId, status: { $in: ['pending', 'approved', 'rescheduled'] } },
      { $set: { ...fields, status, activeBookingKey: input.activeBookingKey } }, { new: true, runValidators: true },
    ).populate('department', 'name').lean().exec()
    return row ? appointmentRecord(row as unknown as AppointmentSource) : null
  },
  async cancelOwnedAppointment(userId, id) {
    const row = await AppointmentModel.findOneAndUpdate(
      { _id: objectId(id), citizen: userId, status: { $in: ['pending', 'approved', 'rescheduled'] } },
      { $set: { status: 'cancelled' }, $unset: { activeBookingKey: 1 } }, { new: true },
    ).populate('department', 'name').lean().exec()
    return row ? appointmentRecord(row as unknown as AppointmentSource) : null
  },
  async createDocument(userId, input) {
    const row = await new DocumentModel({ citizen: userId, documentType: input.documentType, fileMetadata: input.fileMetadata, storageStatus: 'metadata-only' }).save()
    return {
      id: row.id, documentType: row.documentType,
      fileMetadata: { ...input.fileMetadata }, verificationStatus: row.verificationStatus,
      storageStatus: 'metadata-only', uploadDate: row.uploadDate,
    }
  },
  async listOwnedDocuments(userId, skip, limit) {
    const filter = { citizen: userId }
    const [rows, total] = await Promise.all([
      DocumentModel.find(filter).sort({ uploadDate: -1 }).skip(skip).limit(limit).lean().exec(),
      DocumentModel.countDocuments(filter).exec(),
    ])
    return { items: rows.map((row) => ({
      id: row._id.toString(), documentType: row.documentType,
      fileMetadata: { originalName: row.fileMetadata.originalName, mimeType: row.fileMetadata.mimeType, sizeBytes: row.fileMetadata.sizeBytes },
      verificationStatus: row.verificationStatus, storageStatus: row.storageStatus, uploadDate: row.uploadDate,
    })), total }
  },
  async deleteOwnedDocument(userId, id) {
    const result = await DocumentModel.deleteOne({ _id: objectId(id), citizen: userId }).exec()
    return result.deletedCount === 1
  },
  async listNotifications(userId, skip, limit, unreadOnly) {
    const filter = { user: userId, ...(unreadOnly ? { isRead: false } : {}) }
    const [rows, total] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      NotificationModel.countDocuments(filter).exec(),
    ])
    return { items: rows.map((row) => ({ id: row._id.toString(), title: row.title, message: row.message, type: row.type, isRead: row.isRead, createdAt: row.createdAt })), total }
  },
  async markNotificationRead(userId, id) {
    const row = await NotificationModel.findOneAndUpdate({ _id: objectId(id), user: userId }, { $set: { isRead: true } }, { new: true }).lean().exec()
    return row ? { id: row._id.toString(), title: row.title, message: row.message, type: row.type, isRead: row.isRead, createdAt: row.createdAt } : null
  },
  async markAllNotificationsRead(userId) {
    const result = await NotificationModel.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } }).exec()
    return result.modifiedCount
  },
}
