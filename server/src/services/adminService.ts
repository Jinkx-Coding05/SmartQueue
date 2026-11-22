import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'
import { AdminActivityModel, AppointmentModel, CounterModel, DepartmentModel, HospitalSettingsModel, TokenModel, UserModel } from '../models/index.ts'
import { aiInsightsService, type InsightSnapshot } from './aiInsightsService.ts'
import { citizenService } from './citizenService.ts'
import { normalizePhone } from './authValidation.ts'
import { isDuplicateKeyError } from './authRepository.ts'
import { env } from '../config/env.ts'
import { estimateQueue } from './queueEstimate.ts'
import { hospitalDayRange } from './citizenService.ts'
import { mongooseCitizenRepository } from './citizenRepository.ts'

export class AdminError extends Error {
  readonly statusCode: number
  constructor(message: string, statusCode = 400) { super(message); this.name = 'AdminError'; this.statusCode = statusCode }
}

type Page = { page: number; limit: number; search?: string; departmentId?: string; status?: string; from?: string; to?: string }
const dayRange = (from?: string, to?: string) => ({ ...(from ? { $gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { $lte: new Date(`${to}T23:59:59.999Z`) } : {}) })
type PopulateSpec = { path: string; select: string }
const pageResult = async (model: any, filter: any, { page, limit }: Page, populate: PopulateSpec[] = []) => {
  const query = model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
  for (const item of populate) query.populate(item.path, item.select)
  const [items, total] = await Promise.all([query.lean(), model.countDocuments(filter)])
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
}
const id = (value: unknown) => String(value)
export const canTransitionToken = (from: string, to: string) => ({ waiting: ['serving', 'skipped', 'cancelled'], serving: ['completed', 'skipped', 'cancelled'] } as Record<string, string[]>)[from]?.includes(to) ?? false
export const makeRecommendation = (waiting: number, availableCounters: number, averageEstimate: number) => waiting > availableCounters * 5 && averageEstimate > 20 ? { type: 'capacity', severity: waiting > availableCounters * 10 ? 'high' : 'medium', title: 'Consider opening another counter', reason: `${waiting} people are waiting across ${availableCounters} available counters; the stored average wait estimate is ${averageEstimate} minutes.` } : null

export class AdminService {
  async registerWalkInPatient(actor: string, input: { fullName: string; phoneNumber: string; departmentId: string; counterId: string }) {
    const fullName = input.fullName.trim()
    const phoneNumber = normalizePhone(input.phoneNumber)
    const department = await DepartmentModel.findOne({ _id: input.departmentId, isActive: true }).select('_id').lean()
    if (!department) throw new AdminError('Select an active department.', 404)
    const counter = await CounterModel.findOne({ _id: input.counterId, department: input.departmentId, status: { $in: ['active', 'available'] }, currentServingTokenId: null }).select('_id counterNumber').lean()
    if (!counter) throw new AdminError('Select an available counter assigned to this department.', 409)

    let patient = await UserModel.findOne({ phoneNumber })
    let createdPatient = false
    if (patient && patient.role !== 'citizen') throw new AdminError('This phone number belongs to a non-citizen account.', 409)
    if (patient && patient.accountStatus !== 'active') throw new AdminError('The existing patient account is not active.', 409)
    if (!patient) {
      try {
        patient = await UserModel.create({
          fullName,
          phoneNumber,
          email: `walkin-${randomUUID()}@walkin.invalid`,
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
          role: 'citizen',
          emailVerified: true,
          accountStatus: 'active',
        })
        createdPatient = true
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error
        patient = await UserModel.findOne({ phoneNumber })
        if (!patient || patient.role !== 'citizen' || patient.accountStatus !== 'active') throw new AdminError('A patient with this phone number could not be registered safely.', 409)
      }
    }

    let createdTokenId: string | undefined
    try {
      const createdToken = await citizenService.createToken(String(patient._id), { departmentId: input.departmentId })
      createdTokenId = createdToken.id
      const assigned = await TokenModel.findOneAndUpdate(
        { _id: createdToken.id, status: 'waiting' },
        { $set: { counter: counter._id } },
        { new: true },
      )
      if (!assigned) throw new AdminError('The token could not be assigned to the selected counter.', 409)
    } catch (error) {
      if (createdTokenId) await TokenModel.deleteOne({ _id: createdTokenId, status: 'waiting' })
      if (createdPatient) await UserModel.deleteOne({ _id: patient._id })
      throw error
    }

    const created = await this.token(createdTokenId!)
    await this.activity(actor, 'walk-in.registered', 'token', createdTokenId, `Registered walk-in patient ${fullName} with token ${created.tokenNumber} for counter ${counter.counterNumber}`)
    return { patient: { id: id(patient._id), fullName: patient.fullName, phoneNumber: patient.phoneNumber }, token: created }
  }
  async getAdminProfile(userId: string) {
    const user = await UserModel.findOne({ _id: userId, role: 'admin' }).select('fullName email phoneNumber accountStatus createdAt').lean()
    if (!user) throw new AdminError('Admin profile was not found.', 404)
    return { id: id(user._id), fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, accountStatus: user.accountStatus, createdAt: user.createdAt }
  }
  async updateAdminProfile(actor: string, patch: { fullName?: string; phoneNumber?: string }) {
    const user = await UserModel.findOneAndUpdate({ _id: actor, role: 'admin' }, { $set: patch }, { new: true, runValidators: true }).select('fullName email phoneNumber accountStatus createdAt').lean()
    if (!user) throw new AdminError('Admin profile was not found.', 404)
    await this.activity(actor, 'admin.profile.updated', 'profile', actor, 'Updated own admin profile')
    return { id: id(user._id), fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, accountStatus: user.accountStatus, createdAt: user.createdAt }
  }
  async getAdminNotificationPreferences(userId: string) {
    const user = await UserModel.findOne({ _id: userId, role: 'admin' }).select('adminNotificationPreferences').lean()
    if (!user) throw new AdminError('Admin account was not found.', 404)
    return user.adminNotificationPreferences ?? { newAppointments: true, cancellations: true, delays: true, dailySummary: false }
  }
  async updateAdminNotificationPreferences(actor: string, preferences: { newAppointments: boolean; cancellations: boolean; delays: boolean; dailySummary: boolean }) {
    const user = await UserModel.findOneAndUpdate({ _id: actor, role: 'admin' }, { $set: { adminNotificationPreferences: preferences } }, { new: true, runValidators: true }).select('adminNotificationPreferences').lean()
    if (!user) throw new AdminError('Admin account was not found.', 404)
    await this.activity(actor, 'admin.notification-preferences.updated', 'settings', actor, 'Updated own notification preferences')
    return user.adminNotificationPreferences
  }
  async activity(actor: string, action: string, entityType: string, entityId: string | undefined, description: string, demoSeedKey?: string) {
    await AdminActivityModel.create({ actor, action, entityType, entityId, description, ...(demoSeedKey ? { demoSeedKey } : {}) })
  }
  async dashboard() {
    const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1)
    const [tokens, appointmentsToday, totalAppointments, counters, departments, recentActivity, departmentQueues] = await Promise.all([
      TokenModel.aggregate([{ $match: { bookingDate: { $gte: start, $lt: end } } }, { $group: { _id: '$status', count: { $sum: 1 }, averageEstimatedWait: { $avg: '$estimatedWaitingTime' } } }]),
      AppointmentModel.countDocuments({ appointmentDate: { $gte: start, $lt: end } }), AppointmentModel.countDocuments(),
      CounterModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), DepartmentModel.countDocuments({ isActive: true }),
      AdminActivityModel.find().sort({ createdAt: -1 }).limit(10).populate('actor', 'fullName').lean(), this.queueSummary(),
    ])
    const tokensByStatus = Object.fromEntries(tokens.map(x => [x._id, x.count]))
    const totalTokensToday = tokens.reduce((sum, item) => sum + item.count, 0)
    const knownDepartmentEstimates = departmentQueues.map((item) => item.estimatedWaitMinutes).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    return { date: start.toISOString().slice(0, 10), lastUpdatedAt: new Date().toISOString(), totalTokensToday, tokensByStatus, estimatedWaitMinutes: knownDepartmentEstimates.length ? Math.round(knownDepartmentEstimates.reduce((sum, value) => sum + value, 0) / knownDepartmentEstimates.length) : null, totalAppointments, totalAppointmentsToday: appointmentsToday, appointmentsToday, activeCounters: (counters.find(x => x._id === 'active')?.count ?? 0) + (counters.find(x => x._id === 'available')?.count ?? 0), countersByStatus: Object.fromEntries(counters.map(x => [x._id, x.count])), activeDepartments: departments, departmentQueues, recentActivity }
  }
  async listTokens(f: Page) {
    const filter: any = {}; if (f.status) filter.status = f.status; if (f.departmentId) filter.department = f.departmentId
    if (f.from || f.to) filter.bookingDate = dayRange(f.from, f.to)
    if (f.search) { const users = await UserModel.find({ fullName: { $regex: escapeRegex(f.search), $options: 'i' } }).distinct('_id'); filter.$or = [{ tokenNumber: { $regex: escapeRegex(f.search), $options: 'i' } }, { citizen: { $in: users } }] }
    const result = await pageResult(TokenModel, filter, f, [{ path: 'citizen', select: 'fullName' }, { path: 'department', select: 'name' }, { path: 'counter', select: 'name counterNumber' }])
    const now = new Date()
    const snapshots = new Map<string, ReturnType<typeof mongooseCitizenRepository.getQueueSnapshot>>()
    const estimateResults = await Promise.all(result.items.map(async (item: any) => {
      if (!['waiting', 'serving'].includes(item.status)) return { item, estimate: null }
      const departmentId = id(item.department?._id ?? item.department)
      const { start, end } = hospitalDayRange(item.bookingDate, env.hospitalTimeZone)
      const key = `${departmentId}:${start.toISOString()}`
      let snapshotPromise = snapshots.get(key)
      if (!snapshotPromise) { snapshotPromise = mongooseCitizenRepository.getQueueSnapshot(departmentId, start, end); snapshots.set(key, snapshotPromise) }
      const snapshot = await snapshotPromise
      return { item, estimate: estimateQueue(snapshot, id(item._id), now, env.defaultServiceDurationMinutes) }
    }))
    return { ...result, items: estimateResults.map(({ item, estimate }) => ({ ...item, liveEstimatedWaitingTime: estimate?.estimatedWaitingTime ?? null, estimatedArrivalAt: estimate?.estimatedArrivalAt ?? null, patientsAhead: estimate?.patientsAhead ?? null, queueLastUpdatedAt: now.toISOString() })) }
  }
  async token(idValue: string) { const item = await TokenModel.findById(idValue).populate('citizen', 'fullName').populate('department', 'name').populate('counter', 'name counterNumber').lean(); if (!item) throw new AdminError('Token not found.', 404); return item }
  async callToken(actor: string, tokenId: string, counterId?: string, demoSeedKey?: string) {
    const token = await TokenModel.findById(tokenId); if (!token) throw new AdminError('Token not found.', 404); if (token.status !== 'waiting') throw new AdminError('Only waiting tokens can be called.', 409)
    const assignedCounterId = counterId ?? (token.counter ? id(token.counter) : undefined)
    const filter: any = { department: token.department, status: { $in: ['active', 'available'] }, currentServingTokenId: null }; if (assignedCounterId) filter._id = assignedCounterId
    const counter = await CounterModel.findOneAndUpdate(filter, { $set: { status: 'busy' } }, { new: true }); if (!counter) throw new AdminError('No available counter for this department.', 409)
    const calledAt = new Date()
    const claimed = await TokenModel.findOneAndUpdate({ _id: token._id, status: 'waiting' }, { $set: { status: 'serving', counter: counter._id, calledAt, servingAt: calledAt }, $inc: { callCount: 1 } }, { new: true })
    if (!claimed) { counter.status = 'available'; await counter.save(); throw new AdminError('This token was already called by another operator.', 409) }
    counter.currentServingToken = claimed.tokenNumber; counter.currentServingTokenId = claimed._id; await counter.save()
    await this.activity(actor, 'token.called', 'token', tokenId, `Called ${token.tokenNumber} to counter ${counter.counterNumber}`, demoSeedKey); return this.token(tokenId)
  }
  async updateToken(actor: string, tokenId: string, status: string, note?: string, demoSeedKey?: string) {
    const token = await TokenModel.findById(tokenId); if (!token) throw new AdminError('Token not found.', 404)
    if (!canTransitionToken(token.status, status)) throw new AdminError(`Token cannot move from ${token.status} to ${status}.`, 409)
    if (status === 'serving') throw new AdminError('Use the call endpoint to assign a counter before serving a token.', 409)
    const now = new Date(); token.status = status as typeof token.status
    if (status === 'serving') { token.calledAt = now; token.servingAt = now; token.callCount += 1 }
    if (status === 'completed') token.completedAt = now; if (status === 'skipped') token.skippedAt = now; if (status === 'cancelled') token.cancelledAt = now
    await token.save()
    if (token.counter && status !== 'serving') await CounterModel.updateOne({ _id: token.counter, currentServingTokenId: token._id }, { $set: { status: 'available', currentServingToken: null, currentServingTokenId: null } })
    await this.activity(actor, `token.${status}`, 'token', tokenId, `Token ${token.tokenNumber} marked ${status}${note ? `: ${note}` : ''}`, demoSeedKey)
    return this.token(tokenId)
  }
  async callNext(actor: string, departmentId: string, counterId?: string) {
    const [candidates, department] = await Promise.all([TokenModel.find({ department: departmentId, status: 'waiting' }).sort({ bookingDate: 1 }).limit(100).exec(), DepartmentModel.findById(departmentId).select('queueSettings').lean()])
    if (!department) throw new AdminError('Department not found.', 404)
    if (!candidates.length) throw new AdminError('There are no waiting tokens for this department.', 404)
    const weights: Record<string, number> = { emergency: 0, priority: 1, normal: 2 }
    const token = candidates.sort((a, b) => (department.queueSettings?.priorityEnabled === false ? 0 : weights[a.priority] - weights[b.priority]) || a.bookingDate.getTime() - b.bookingDate.getTime())[0]
    const assignedCounterId = counterId ?? (token.counter ? id(token.counter) : undefined)
    const filter: any = { department: departmentId, status: { $in: ['active', 'available'] }, currentServingTokenId: null }; if (assignedCounterId) filter._id = assignedCounterId
    const counter = await CounterModel.findOneAndUpdate(filter, { $set: { status: 'busy' } }, { new: true })
    if (!counter) throw new AdminError('No available counter for this department and token assignment.', 409)
    const calledAt = new Date()
    const claimed = await TokenModel.findOneAndUpdate({ _id: token._id, status: 'waiting' }, { $set: { status: 'serving', counter: counter._id, calledAt, servingAt: calledAt }, $inc: { callCount: 1 } }, { new: true })
    if (!claimed) { counter.status = 'available'; await counter.save(); throw new AdminError('This token was already called by another operator.', 409) }
    counter.currentServingToken = claimed.tokenNumber; counter.currentServingTokenId = claimed._id; await counter.save()
    await this.activity(actor, 'queue.call-next', 'queue', departmentId, `Called ${claimed.tokenNumber} to counter ${counter.counterNumber}`)
    return this.token(id(claimed._id))
  }
  async listAppointments(f: Page) {
    const filter: any = {}; if (f.status) filter.status = f.status; if (f.departmentId) filter.department = f.departmentId
    if (f.from || f.to) filter.appointmentDate = dayRange(f.from, f.to)
    if (f.search) { const users = await UserModel.find({ fullName: { $regex: escapeRegex(f.search), $options: 'i' } }).distinct('_id'); filter.$or = [{ appointmentId: { $regex: escapeRegex(f.search), $options: 'i' } }, { citizen: { $in: users } }] }
    return pageResult(AppointmentModel, filter, f, [{ path: 'citizen', select: 'fullName' }, { path: 'department', select: 'name' }])
  }
  async appointment(idValue: string) { const item = await AppointmentModel.findById(idValue).populate('citizen', 'fullName').populate('department', 'name').lean(); if (!item) throw new AdminError('Appointment not found.', 404); return item }
  async updateAppointment(actor: string, appointmentId: string, status: string, note?: string) {
    const item = await AppointmentModel.findById(appointmentId); if (!item) throw new AdminError('Appointment not found.', 404)
    if (['completed', 'cancelled'].includes(item.status)) throw new AdminError('This appointment is already closed.', 409)
    const allowed: Record<string, string[]> = { pending: ['approved', 'cancelled'], approved: ['rescheduled', 'completed', 'cancelled'], rescheduled: ['approved', 'rescheduled', 'completed', 'cancelled'] }
    if (!allowed[item.status]?.includes(status)) throw new AdminError(`Appointment cannot move from ${item.status} to ${status}.`, 409)
    item.status = status as typeof item.status; item.statusHistory.push({ status: item.status, changedAt: new Date(), changedBy: new mongoose.Types.ObjectId(actor), ...(note ? { note } : {}) })
    await item.save(); await this.activity(actor, `appointment.${status}`, 'appointment', appointmentId, `${item.appointmentId} marked ${status}`); return item
  }
  async rescheduleAppointment(actor: string, appointmentId: string, appointmentDate: string, appointmentTime: string, note?: string) {
    const item = await AppointmentModel.findById(appointmentId); if (!item) throw new AdminError('Appointment not found.', 404)
    if (['completed', 'cancelled'].includes(item.status)) throw new AdminError('This appointment cannot be rescheduled.', 409)
    const date = new Date(`${appointmentDate}T00:00:00.000Z`)
    const conflict = await AppointmentModel.exists({ _id: { $ne: item._id }, department: item.department, appointmentDate: date, appointmentTime, status: { $in: ['pending', 'approved', 'rescheduled'] } })
    if (conflict) throw new AdminError('That department time slot is already occupied.', 409)
    item.appointmentDate = date; item.appointmentTime = appointmentTime; item.status = 'rescheduled'; item.rescheduleCount += 1
    item.statusHistory.push({ status: 'rescheduled', changedAt: new Date(), changedBy: new mongoose.Types.ObjectId(actor), ...(note ? { note } : {}) })
    await item.save(); await this.activity(actor, 'appointment.rescheduled', 'appointment', appointmentId, `${item.appointmentId} rescheduled to ${appointmentDate} ${appointmentTime}`); return item
  }
  async listDepartments(f: Page & { isActive?: string }) { const filter: any = {}; if (f.isActive) filter.isActive = f.isActive === 'true'; if (f.search) filter.name = { $regex: escapeRegex(f.search), $options: 'i' }; return pageResult(DepartmentModel, filter, f) }
  async department(idValue: string) { const item = await DepartmentModel.findById(idValue).lean(); if (!item) throw new AdminError('Department not found.', 404); return item }
  async createDepartment(actor: string, data: any) { const item = await DepartmentModel.create(data); await this.activity(actor, 'department.created', 'department', id(item._id), `Created department ${item.name}`); return item }
  async updateDepartment(actor: string, idValue: string, data: any) { const item = await DepartmentModel.findByIdAndUpdate(idValue, { $set: data }, { new: true, runValidators: true }); if (!item) throw new AdminError('Department not found.', 404); await this.activity(actor, 'department.updated', 'department', idValue, `Updated department ${item.name}`); return item }
  async deleteDepartment(actor: string, idValue: string) { const [tokens, appointments, counters] = await Promise.all([TokenModel.exists({ department: idValue }), AppointmentModel.exists({ department: idValue }), CounterModel.exists({ department: idValue })]); if (tokens || appointments || counters) throw new AdminError('Department is in use and cannot be deleted. Deactivate it instead.', 409); const item = await DepartmentModel.findByIdAndDelete(idValue); if (!item) throw new AdminError('Department not found.', 404); await this.activity(actor, 'department.deleted', 'department', idValue, `Deleted department ${item.name}`); return { deleted: true } }
  async listCounters(f: Page) { const filter: any = {}; if (f.status) filter.status = f.status; if (f.departmentId) filter.department = f.departmentId; if (f.search) filter.$or = [{ name: { $regex: escapeRegex(f.search), $options: 'i' } }, { counterNumber: { $regex: escapeRegex(f.search), $options: 'i' } }]; return pageResult(CounterModel, filter, f, [{ path: 'department', select: 'name' }]) }
  async counter(idValue: string) { const item = await CounterModel.findById(idValue).populate('department', 'name').lean(); if (!item) throw new AdminError('Counter not found.', 404); return item }
  async createCounter(actor: string, data: any) { if (!await DepartmentModel.exists({ _id: data.departmentId })) throw new AdminError('Department not found.', 404); const item = await CounterModel.create({ ...data, department: data.departmentId }); await this.activity(actor, 'counter.created', 'counter', id(item._id), `Created counter ${item.counterNumber}`); return item }
  async updateCounter(actor: string, idValue: string, data: any) { const item = await CounterModel.findById(idValue); if (!item) throw new AdminError('Counter not found.', 404); if (item.currentServingTokenId && data.departmentId && id(item.department) !== data.departmentId) throw new AdminError('A counter serving a token cannot be reassigned.', 409); if (data.departmentId && !await DepartmentModel.exists({ _id: data.departmentId })) throw new AdminError('Department not found.', 404); if (data.departmentId) item.department = new mongoose.Types.ObjectId(data.departmentId); if (data.name) item.name = data.name; if (data.counterNumber) item.counterNumber = data.counterNumber; await item.save(); await this.activity(actor, 'counter.updated', 'counter', idValue, `Updated counter ${item.counterNumber}`); return item }
  async setCounterStatus(actor: string, idValue: string, status: string) { const item = await CounterModel.findById(idValue); if (!item) throw new AdminError('Counter not found.', 404); if (item.currentServingTokenId && status !== 'busy') throw new AdminError('Complete or skip the serving token before changing this counter.', 409); item.status = status as typeof item.status; await item.save(); await this.activity(actor, 'counter.status', 'counter', idValue, `Counter ${item.counterNumber} marked ${status}`); return item }
  async deleteCounter(actor: string, idValue: string) { const item = await CounterModel.findById(idValue); if (!item) throw new AdminError('Counter not found.', 404); if (item.currentServingTokenId) throw new AdminError('A counter serving a token cannot be deleted.', 409); await item.deleteOne(); await this.activity(actor, 'counter.deleted', 'counter', idValue, `Deleted counter ${item.counterNumber}`); return { deleted: true } }
  async queueSummary() {
    const now = new Date()
    const { start, end } = hospitalDayRange(now, env.hospitalTimeZone)
    const departments = await DepartmentModel.find({ isActive: true }).lean().exec()
    return Promise.all(departments.map(async (department) => {
      const queueFilter = { department: department._id, bookingDate: { $gte: start, $lt: end } }
      const [waiting, serving, snapshot] = await Promise.all([
        TokenModel.countDocuments({ ...queueFilter, status: 'waiting' }).exec(),
        TokenModel.countDocuments({ ...queueFilter, status: 'serving' }).exec(),
        mongooseCitizenRepository.getQueueSnapshot(id(department._id), start, end),
      ])
      const weights: Record<string, number> = { emergency: 0, priority: 1, normal: 2 }
      const next = snapshot.tokens.filter((item) => item.status === 'waiting').sort((a, b) => (snapshot.priorityEnabled ? weights[a.priority] - weights[b.priority] : 0) || a.bookingDate.getTime() - b.bookingDate.getTime() || a.id.localeCompare(b.id))[0]
      const estimate = next ? estimateQueue(snapshot, next.id, now, env.defaultServiceDurationMinutes) : null
      return { department, waiting, serving, estimatedWaitMinutes: estimate?.estimatedWaitingTime ?? null, estimatedArrivalAt: estimate?.estimatedArrivalAt ?? null }
    }))
  }
  async queueDepartment(departmentId: string) { const summary = await this.queueSummary(); const result = summary.find(x => id(x.department._id) === departmentId); if (!result) throw new AdminError('Department not found or inactive.', 404); const [waitingTokens, servingTokens, counters] = await Promise.all([TokenModel.find({ department: departmentId, status: 'waiting' }).sort({ bookingDate: 1 }).limit(100).populate('citizen', 'fullName').lean(), TokenModel.find({ department: departmentId, status: 'serving' }).populate('citizen', 'fullName').populate('counter', 'name counterNumber').lean(), CounterModel.find({ department: departmentId }).lean()]); const weights: Record<string, number> = { emergency: 0, priority: 1, normal: 2 }; const ordered = result.department.queueSettings?.priorityEnabled === false ? waitingTokens : waitingTokens.sort((a, b) => weights[a.priority] - weights[b.priority] || a.bookingDate.getTime() - b.bookingDate.getTime()); return { ...result, waitingTokens: ordered.map((token, index) => ({ ...token, queuePosition: index + 1 })), servingTokens, counters } }
  async queueSettings(departmentId: string) { const d = await DepartmentModel.findById(departmentId); if (!d) throw new AdminError('Department not found.', 404); return { departmentId, settings: d.queueSettings ?? {} } }
  async updateQueueSettings(actor: string, departmentId: string, settings: any) { const d = await DepartmentModel.findByIdAndUpdate(departmentId, { $set: { queueSettings: settings } }, { new: true, runValidators: true }); if (!d) throw new AdminError('Department not found.', 404); await this.activity(actor, 'queue.settings', 'queue', departmentId, `Updated queue settings for ${d.name}`); return d.queueSettings }
  async settings() { let s = await HospitalSettingsModel.findOne({ singleton: 'global' }).lean(); if (!s) s = await HospitalSettingsModel.create({}).then(x => x.toObject()); return s }
  async updateSettings(actor: string, data: any) { const s = await HospitalSettingsModel.findOneAndUpdate({ singleton: 'global' }, { $set: data, $setOnInsert: { singleton: 'global' } }, { new: true, upsert: true, runValidators: true }); await this.activity(actor, 'settings.updated', 'settings', id(s._id), 'Updated hospital and queue settings'); return s }
  async activityList(f: Page & { entityType?: string }) { const filter: any = f.entityType ? { entityType: f.entityType } : {}; return pageResult(AdminActivityModel, filter, f, [{ path: 'actor', select: 'fullName' }]) }
  async reports(from?: string, to?: string, departmentId?: string) { const match: any = {}; if (from || to) match.bookingDate = dayRange(from, to); if (departmentId) match.department = new mongoose.Types.ObjectId(departmentId); const [tokens, appointments, daily, departments] = await Promise.all([TokenModel.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, avgEstimatedWait: { $avg: '$estimatedWaitingTime' } } }]), AppointmentModel.aggregate([{ $match: { ...(departmentId ? { department: new mongoose.Types.ObjectId(departmentId) } : {}), ...(from || to ? { appointmentDate: dayRange(from, to) } : {}) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]), TokenModel.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } }, total: { $sum: 1 }, statuses: { $push: '$status' } } }, { $sort: { _id: 1 } }]), TokenModel.aggregate([{ $match: match }, { $group: { _id: '$department', count: { $sum: 1 }, averageEstimatedWait: { $avg: '$estimatedWaitingTime' } } }, { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } }, { $unwind: '$department' }])]); return { source: 'MongoDB records; waiting values are stored estimates', tokensByStatus: tokens, appointmentsByStatus: appointments, daily, departments } }
  async insights(departmentId?: string) {
    return aiInsightsService.getInsights(departmentId, () => this.insightSnapshot(departmentId))
  }
  async refreshInsights(departmentId?: string) {
    return aiInsightsService.getInsights(departmentId, () => this.insightSnapshot(departmentId), true)
  }
  private async insightSnapshot(departmentId?: string): Promise<InsightSnapshot> {
    const now = new Date()
    const historicalStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const departmentFilter = departmentId ? { department: new mongoose.Types.ObjectId(departmentId) } : {}
    const recentFilter = { ...departmentFilter, bookingDate: { $gte: historicalStart, $lte: now } }
    const completedFilter = { ...recentFilter, status: 'completed', servingAt: { $type: 'date' }, completedAt: { $type: 'date' } }
    const appointmentFilter = { ...(departmentId ? { department: new mongoose.Types.ObjectId(departmentId) } : {}), appointmentDate: { $gte: historicalStart, $lte: now } }
    const [hours, waitingStats, departmentRows, counterRows, serviceRows, dailyRows, weekdayRows, historicalCount, appointmentRows, tokenOutcomeRows] = await Promise.all([
      TokenModel.aggregate([{ $match: recentFilter }, { $group: { _id: { $hour: '$bookingDate' }, bookings: { $sum: 1 } } }, { $sort: { bookings: -1 } }, { $limit: 5 }]),
      TokenModel.aggregate([{ $match: { ...departmentFilter, status: 'waiting' } }, { $group: { _id: null, waiting: { $sum: 1 }, avgWaitEstimate: { $avg: '$estimatedWaitingTime' } } }]),
      TokenModel.aggregate([{ $match: recentFilter }, { $group: {
        _id: '$department', tokens: { $sum: 1 }, avgWaitEstimate: { $avg: '$estimatedWaitingTime' },
        waitingTokens: { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } },
        servingTokens: { $sum: { $cond: [{ $eq: ['$status', 'serving'] }, 1, 0] } },
      } }, { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } }, { $unwind: '$department' }, { $project: { name: '$department.name', tokens: 1, avgWaitEstimate: 1, waitingTokens: 1, servingTokens: 1 } }, { $sort: { tokens: -1 } }, { $limit: 20 }]),
      CounterModel.aggregate([{ $match: { ...departmentFilter, status: { $in: ['active', 'available', 'busy'] } } }, { $group: { _id: '$department', activeCounters: { $sum: 1 } } }]),
      TokenModel.aggregate([{ $match: completedFilter }, { $project: { department: 1, durationMinutes: { $divide: [{ $subtract: ['$completedAt', '$servingAt'] }, 60000] } } }, { $match: { durationMinutes: { $gte: 1, $lte: 240 } } }, { $group: { _id: '$department', completedServiceSamples: { $sum: 1 }, averageServiceDurationMinutes: { $avg: '$durationMinutes' } } }]),
      TokenModel.aggregate([{ $match: recentFilter }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } }, tokens: { $sum: 1 }, waiting: { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }, { $sort: { _id: 1 } }]),
      TokenModel.aggregate([{ $match: recentFilter }, { $group: { _id: { weekday: { $subtract: [{ $dayOfWeek: '$bookingDate' }, 1] }, date: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } } }, bookings: { $sum: 1 } } }, { $group: { _id: '$_id.weekday', bookings: { $sum: '$bookings' }, observedDays: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      TokenModel.countDocuments(recentFilter),
      AppointmentModel.aggregate([{ $match: appointmentFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      TokenModel.aggregate([{ $match: recentFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ])
    const byDepartment = (rows: Array<{ _id: unknown; [key: string]: unknown }>) => new Map(rows.map((row) => [String(row._id), row]))
    const counters = byDepartment(counterRows)
    const durations = byDepartment(serviceRows)
    const departmentPerformance = departmentRows.map((row: { _id: unknown; name: string; tokens: number; avgWaitEstimate?: number; waitingTokens?: number; servingTokens?: number }) => {
      const counter = counters.get(String(row._id))
      const duration = durations.get(String(row._id))
      return {
        department: { name: row.name }, tokens: row.tokens, avgWaitEstimate: Math.round(row.avgWaitEstimate ?? 0),
        waitingTokens: row.waitingTokens ?? 0, servingTokens: row.servingTokens ?? 0,
        activeCounters: Number(counter?.activeCounters ?? 0),
        completedServiceSamples: Number(duration?.completedServiceSamples ?? 0),
        averageServiceDurationMinutes: typeof duration?.averageServiceDurationMinutes === 'number' ? Math.round(duration.averageServiceDurationMinutes * 10) / 10 : null,
      }
    })
    const waiting = waitingStats[0]?.waiting ?? 0
    const average = Math.round(waitingStats[0]?.avgWaitEstimate ?? 0)
    const activeCounters = counterRows.reduce((sum: number, row: { activeCounters: number }) => sum + row.activeCounters, 0)
    const appointmentCounts = Object.fromEntries(appointmentRows.map((row: { _id: string; count: number }) => [row._id, row.count]))
    const appointmentTotal = Object.values(appointmentCounts).reduce((sum, count) => sum + Number(count), 0)
    const tokenCounts = Object.fromEntries(tokenOutcomeRows.map((row: { _id: string; count: number }) => [row._id, row.count]))
    const ratio = (count: number, total: number) => total ? Math.round((count / total) * 1000) / 10 : 0
    const recommendation = makeRecommendation(waiting, activeCounters, average)
    return {
      peakHours: hours.map((row: { _id: number; bookings: number }) => ({ hour: row._id, bookings: row.bookings })),
      waiting: { count: waiting, averageEstimatedWaitMinutes: average },
      departmentPerformance,
      historicalTokenCount: historicalCount,
      observedDays: dailyRows.length,
      trafficByWeekday: weekdayRows.map((row: { _id: number; bookings: number; observedDays: number }) => ({ weekday: row._id, bookings: row.bookings, observedDays: row.observedDays })),
      historicalQueueTrend: dailyRows.map((row: { _id: string; tokens: number; waiting: number; completed: number; cancelled: number }) => ({ date: row._id, tokens: row.tokens, waiting: row.waiting, completed: row.completed, cancelled: row.cancelled })).slice(-30),
      appointments: { total: appointmentTotal, completed: Number(appointmentCounts.completed ?? 0), cancelled: Number(appointmentCounts.cancelled ?? 0), completionRate: ratio(Number(appointmentCounts.completed ?? 0), appointmentTotal), cancellationRate: ratio(Number(appointmentCounts.cancelled ?? 0), appointmentTotal) },
      tokenOutcomes: { completed: Number(tokenCounts.completed ?? 0), cancelled: Number(tokenCounts.cancelled ?? 0), completionRate: ratio(Number(tokenCounts.completed ?? 0), historicalCount), cancellationRate: ratio(Number(tokenCounts.cancelled ?? 0), historicalCount) },
      activeCounterCount: activeCounters,
      recommendations: recommendation ? [recommendation] : [],
    }
  }
}
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
export const adminService = new AdminService()
