import { randomBytes, randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { env } from '../config/env.ts'
import type { AppointmentStatus } from '../models/sharedEnums.ts'
import { normalizePhone } from './authValidation.ts'
import type { CitizenRepository, ProfileRecord, DepartmentRecord, TokenRecord, AppointmentRecord, DocumentRecord, NotificationRecord } from './citizenRepository.ts'
import { mongooseCitizenRepository, type PageResult } from './citizenRepository.ts'
import type { CreateAppointmentInput, CreateDocumentInput, CreateTokenInput, PaginationInput, PatchAppointmentInput, ProfilePatch } from './citizenValidation.ts'

const ACTIVE_APPOINTMENTS: AppointmentStatus[] = ['pending', 'approved', 'rescheduled']

export class CitizenError extends Error {
  readonly statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'CitizenError'
    this.statusCode = statusCode
  }
}

export class CitizenService {
  private readonly repository: CitizenRepository

  constructor(repository: CitizenRepository = mongooseCitizenRepository) {
    this.repository = repository
  }

  async getProfile(userId: string) {
    const profile = await this.repository.getProfile(userId)
    if (!profile) throw new CitizenError('Profile was not found.', 404)
    return safeProfile(profile)
  }

  async updateProfile(userId: string, patch: ProfilePatch) {
    if (patch.phoneNumber) {
      const normalized = normalizePhone(patch.phoneNumber)
      if (!/^\+?[1-9]\d{7,14}$/.test(normalized)) throw new CitizenError('Enter a valid international phone number.', 400)
      patch = { ...patch, phoneNumber: normalized }
    }
    if (patch.dateOfBirth) {
      const date = new Date(`${patch.dateOfBirth}T00:00:00.000Z`)
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== patch.dateOfBirth || date > new Date()) throw new CitizenError('Date of birth must be a valid date and cannot be in the future.', 400)
    }
    try {
      const profile = await this.repository.updateProfile(userId, patch)
      if (!profile) throw new CitizenError('Profile was not found.', 404)
      return safeProfile(profile)
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new CitizenError('That phone number is already associated with another account.', 409)
      throw error
    }
  }

  async listDepartments() {
    const departments = await this.repository.listActiveDepartments()
    return departments.map(safeDepartment)
  }

  async getDepartment(id: string) {
    ensureObjectId(id)
    const department = await this.repository.getActiveDepartment(id)
    if (!department) throw new CitizenError('Department was not found.', 404)
    return safeDepartment(department)
  }

  async createToken(userId: string, input: CreateTokenInput, options: { demoSeedKey?: string } = {}) {
    const { departmentId } = input
    ensureObjectId(departmentId)
    await this.requireAvailableDepartment(departmentId)
    let preferredVisitDate: Date | undefined
    let activePreferenceKey: string | undefined
    if (input.preferredVisitDate && input.preferredTime && input.visitType) {
      preferredVisitDate = parseDateOnly(input.preferredVisitDate)
      validateAppointmentDateTime(preferredVisitDate, input.preferredTime, env.hospitalTimeZone)
      const preferenceDay = input.preferredVisitDate
      activePreferenceKey = `${userId}:${departmentId}:${preferenceDay}:${input.preferredTime}`
      if (await this.repository.hasActivePreferenceKey(activePreferenceKey)) throw new CitizenError('An active token already uses these visit preferences.', 409)
    }
    const { start, end } = hospitalDayRange(new Date(), env.hospitalTimeZone)
    if (await this.repository.findActiveToken(userId, departmentId, start, end)) {
      throw new CitizenError('You already have an active token for this department today.', 409)
    }
    const estimatedWaitingTime = await this.repository.getQueueWaitEstimate(departmentId, start, end)
    const bookingDate = new Date()
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const tokenNumber = `SQ-${dayKey(bookingDate, env.hospitalTimeZone)}-${randomBytes(3).toString('hex').toUpperCase()}`
      try {
        return safeToken(await this.repository.createToken({
          tokenNumber, userId, departmentId, bookingDate,
          activeBookingKey: `${userId}:${departmentId}:${dayKey(bookingDate, env.hospitalTimeZone)}`,
          estimatedWaitingTime,
          ...(options.demoSeedKey ? { demoSeedKey: options.demoSeedKey } : {}),
          ...(preferredVisitDate ? { preferredVisitDate, preferredTime: input.preferredTime, visitType: input.visitType, activePreferenceKey } : {}),
        }))
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error
        if (activePreferenceKey && await this.repository.hasActivePreferenceKey(activePreferenceKey)) throw new CitizenError('An active token already uses these visit preferences.', 409)
        if (await this.repository.findActiveToken(userId, departmentId, start, end)) {
          throw new CitizenError('You already have an active token for this department today.', 409)
        }
        if (attempt === 3) throw new CitizenError('Unable to allocate a unique token. Please retry.', 503)
      }
    }
    throw new CitizenError('Unable to allocate a unique token. Please retry.', 503)
  }

  async listMyTokens(userId: string, pagination: PaginationInput) {
    return paginated(await this.repository.listOwnedTokens(userId, offset(pagination), pagination.limit), pagination)
  }

  async getMyToken(userId: string, tokenId: string) {
    ensureObjectId(tokenId)
    const token = await this.repository.getOwnedToken(userId, tokenId)
    if (!token) throw new CitizenError('Token was not found.', 404)
    return safeToken(token)
  }

  async cancelToken(userId: string, tokenId: string) {
    ensureObjectId(tokenId)
    const token = await this.repository.getOwnedToken(userId, tokenId)
    if (!token) throw new CitizenError('Token was not found.', 404)
    if (token.status !== 'waiting') throw new CitizenError('Only waiting tokens can be cancelled.', 409)
    const cancelled = await this.repository.cancelOwnedToken(userId, tokenId)
    if (!cancelled) throw new CitizenError('Token status changed. Refresh and try again.', 409)
    return safeToken(cancelled)
  }

  async trackToken(userId: string, tokenId: string) {
    ensureObjectId(tokenId)
    const token = await this.repository.getOwnedToken(userId, tokenId)
    if (!token) throw new CitizenError('Token was not found.', 404)
    const { start, end } = hospitalDayRange(token.bookingDate, env.hospitalTimeZone)
    const ahead = token.status === 'waiting' ? await this.repository.countWaitingAhead(token.departmentId, token.bookingDate, token.id, start, end) : 0
    const serving = await this.repository.getCurrentlyServing(token.departmentId, start, end)
    const queuePosition = token.status === 'waiting' ? ahead + 1 : token.status === 'serving' ? 0 : null
    return {
      id: token.id,
      tokenNumber: token.tokenNumber,
      preferredVisitDate: token.preferredVisitDate?.toISOString().slice(0, 10) ?? null,
      preferredTime: token.preferredTime ?? null,
      visitType: token.visitType ?? null,
      status: token.status,
      queuePosition,
      department: { id: token.departmentId, name: token.departmentName },
      assignedCounter: token.counterId ? { id: token.counterId, name: token.counterName } : null,
      currentlyServingToken: serving?.tokenNumber ?? null,
      estimatedWaitingTime: token.status === 'waiting' ? token.estimatedWaitingTime : 0,
      lastUpdatedAt: token.updatedAt,
    }
  }

  async createAppointment(userId: string, input: CreateAppointmentInput) {
    ensureObjectId(input.departmentId)
    const appointmentDate = parseDateOnly(input.appointmentDate)
    const department = await this.requireAvailableDepartment(input.departmentId)
    validateAppointmentDateTime(appointmentDate, input.appointmentTime, env.hospitalTimeZone)
    validateWorkingHours(department, appointmentDate, input.appointmentTime)
    if (await this.repository.findDuplicateAppointment(userId, input.departmentId, appointmentDate, input.appointmentTime)) {
      throw new CitizenError('You already have an appointment for this department at that time.', 409)
    }
    const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`
    try {
      return safeAppointment(await this.repository.createAppointment({
        appointmentId, userId, departmentId: input.departmentId, appointmentDate,
        appointmentTime: input.appointmentTime, notes: input.notes ?? '',
        activeBookingKey: appointmentKey(userId, input.departmentId, appointmentDate, input.appointmentTime),
      }))
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new CitizenError('You already have an appointment for this department at that time.', 409)
      throw error
    }
  }

  async listMyAppointments(userId: string, pagination: PaginationInput) {
    return paginated(await this.repository.listOwnedAppointments(userId, offset(pagination), pagination.limit), pagination)
  }

  async getMyAppointment(userId: string, id: string) {
    ensureObjectId(id)
    const appointment = await this.repository.getOwnedAppointment(userId, id)
    if (!appointment) throw new CitizenError('Appointment was not found.', 404)
    return safeAppointment(appointment)
  }

  async updateAppointment(userId: string, id: string, patch: PatchAppointmentInput) {
    ensureObjectId(id)
    const current = await this.repository.getOwnedAppointment(userId, id)
    if (!current) throw new CitizenError('Appointment was not found.', 404)
    if (!ACTIVE_APPOINTMENTS.includes(current.status)) throw new CitizenError('This appointment can no longer be changed.', 409)
    const dateString = patch.appointmentDate ?? current.appointmentDate.toISOString().slice(0, 10)
    const time = patch.appointmentTime ?? current.appointmentTime
    const appointmentDate = parseDateOnly(dateString)
    validateAppointmentDateTime(appointmentDate, time, env.hospitalTimeZone)
    const department = await this.requireAvailableDepartment(current.departmentId)
    validateWorkingHours(department, appointmentDate, time)
    const isReschedule = dateString !== current.appointmentDate.toISOString().slice(0, 10) || time !== current.appointmentTime
    if (isReschedule && await this.repository.findDuplicateAppointment(userId, current.departmentId, appointmentDate, time, id)) {
      throw new CitizenError('You already have an appointment for this department at that time.', 409)
    }
    let updated: AppointmentRecord | null
    try {
      updated = await this.repository.updateOwnedAppointment(userId, id, {
        ...(patch.appointmentDate ? { appointmentDate } : {}),
        ...(patch.appointmentTime ? { appointmentTime: time } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        status: isReschedule ? 'rescheduled' : current.status,
        activeBookingKey: appointmentKey(userId, current.departmentId, appointmentDate, time),
      })
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new CitizenError('You already have an appointment for this department at that time.', 409)
      throw error
    }
    if (!updated) throw new CitizenError('Appointment status changed. Refresh and try again.', 409)
    return safeAppointment(updated)
  }

  async cancelAppointment(userId: string, id: string) {
    ensureObjectId(id)
    const current = await this.repository.getOwnedAppointment(userId, id)
    if (!current) throw new CitizenError('Appointment was not found.', 404)
    if (!ACTIVE_APPOINTMENTS.includes(current.status)) throw new CitizenError('This appointment can no longer be cancelled.', 409)
    const cancelled = await this.repository.cancelOwnedAppointment(userId, id)
    if (!cancelled) throw new CitizenError('Appointment status changed. Refresh and try again.', 409)
    return safeAppointment(cancelled)
  }

  async createDocument(userId: string, input: CreateDocumentInput) {
    return safeDocument(await this.repository.createDocument(userId, input))
  }

  async listMyDocuments(userId: string, pagination: PaginationInput) {
    return paginated(await this.repository.listOwnedDocuments(userId, offset(pagination), pagination.limit), pagination)
  }

  async deleteDocument(userId: string, id: string) {
    ensureObjectId(id)
    if (!await this.repository.deleteOwnedDocument(userId, id)) throw new CitizenError('Document was not found.', 404)
  }

  async listMyNotifications(userId: string, pagination: PaginationInput, unreadOnly = false) {
    return paginated(await this.repository.listNotifications(userId, offset(pagination), pagination.limit, unreadOnly), pagination)
  }

  async markNotificationRead(userId: string, id: string) {
    ensureObjectId(id)
    const notification = await this.repository.markNotificationRead(userId, id)
    if (!notification) throw new CitizenError('Notification was not found.', 404)
    return safeNotification(notification)
  }

  markAllNotificationsRead(userId: string) {
    return this.repository.markAllNotificationsRead(userId)
  }

  private async requireAvailableDepartment(id: string) {
    const department = await this.repository.getActiveDepartment(id)
    if (!department) throw new CitizenError('Department was not found or is inactive.', 404)
    if (!department.available) throw new CitizenError('This department is currently unavailable.', 409)
    return department
  }
}

export const citizenService = new CitizenService()

function safeProfile(value: ProfileRecord) {
  return {
    id: value.id, fullName: value.fullName, email: value.email, phoneNumber: value.phoneNumber,
    dateOfBirth: value.dateOfBirth?.toISOString().slice(0, 10) ?? '', gender: value.gender ?? '',
    profileImage: value.profileImage ?? '', address: value.address ?? {}, accountStatus: value.accountStatus, createdAt: value.createdAt,
  }
}
function safeDepartment(value: DepartmentRecord) {
  return { id: value.id, name: value.name, description: value.description, workingHours: value.workingHours, activeCounterCount: value.activeCounterCount, available: value.available }
}
function safeToken(value: TokenRecord) {
  return {
    id: value.id, tokenNumber: value.tokenNumber, department: { id: value.departmentId, name: value.departmentName },
    assignedCounter: value.counterId ? { id: value.counterId, name: value.counterName } : null,
    status: value.status, bookingDate: value.bookingDate, estimatedWaitingTime: value.estimatedWaitingTime,
    preferredVisitDate: value.preferredVisitDate?.toISOString().slice(0, 10) ?? null, preferredTime: value.preferredTime ?? null, visitType: value.visitType ?? null,
    createdAt: value.createdAt, updatedAt: value.updatedAt,
  }
}
function safeAppointment(value: AppointmentRecord) {
  return {
    id: value.id, appointmentId: value.appointmentId, department: { id: value.departmentId, name: value.departmentName },
    appointmentDate: value.appointmentDate.toISOString().slice(0, 10), appointmentTime: value.appointmentTime,
    status: value.status, notes: value.notes, createdAt: value.createdAt, updatedAt: value.updatedAt,
  }
}
function safeDocument(value: DocumentRecord) {
  return { ...value, storageMessage: value.storageStatus === 'metadata-only' ? 'Metadata saved only; file storage is not configured.' : 'File stored.' }
}
function safeNotification(value: NotificationRecord) { return value }
function paginated<T>(result: PageResult<T>, page: PaginationInput) {
  return { items: result.items, pagination: { page: page.page, limit: page.limit, total: result.total, pages: Math.ceil(result.total / page.limit) } }
}
function offset(pagination: PaginationInput) { return (pagination.page - 1) * pagination.limit }
function ensureObjectId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new CitizenError('The requested ID is invalid.', 400)
}
function isDuplicateKeyError(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000 }
function hospitalDayRange(date: Date, timeZone: string) {
  const parts = dateParts(date, timeZone)
  const nextDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1))
  const start = zonedMidnight(parts.year, parts.month, parts.day, timeZone)
  const end = zonedMidnight(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, nextDate.getUTCDate(), timeZone)
  return { start, end }
}
function dayKey(date: Date, timeZone: string) {
  const parts = dateParts(date, timeZone)
  return `${parts.year}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`
}
function appointmentKey(userId: string, departmentId: string, date: Date, time: string) {
  return `${userId}:${departmentId}:${date.toISOString().slice(0, 10)}:${time}`
}
function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new CitizenError('Enter a valid appointment date.', 400)
  return date
}
function validateAppointmentDateTime(date: Date, time: string, timeZone: string) {
  const now = new Date()
  const requestedDate = date.toISOString().slice(0, 10)
  const currentDate = formattedDate(now, timeZone)
  if (requestedDate < currentDate || (requestedDate === currentDate && time <= formattedTime(now, timeZone))) {
    throw new CitizenError('Appointment date and time must be in the future.', 400)
  }
}
function validateWorkingHours(department: DepartmentRecord, date: Date, time: string) {
  if (!department.workingHours.length) return
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const hours = department.workingHours.find((item) => item.day === days[date.getUTCDay()])
  if (!hours || hours.isClosed || time < hours.opensAt || time >= hours.closesAt) {
    throw new CitizenError('The department is not available at the selected date and time.', 409)
  }
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  }
}
function formattedDate(date: Date, timeZone: string) {
  const parts = dateParts(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}
function formattedTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}
function zonedMidnight(year: number, month: number, day: number, timeZone: string) {
  const nominalUtc = Date.UTC(year, month - 1, day)
  const date = new Date(nominalUtc)
  const formatted = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(formatted.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
  return new Date(nominalUtc - (asUtc - nominalUtc))
}
