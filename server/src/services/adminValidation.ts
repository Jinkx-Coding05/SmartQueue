import { z } from 'zod'

const objectId = z.string().length(24).regex(/^[\da-f]+$/i)
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const pagination = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
const filterBase = pagination.extend({ search: z.string().trim().max(100).optional(), departmentId: objectId.optional(), from: dateOnly.optional(), to: dateOnly.optional() })

export const adminTokenQuerySchema = filterBase.extend({ status: z.enum(['waiting', 'serving', 'completed', 'skipped', 'cancelled']).optional() }).strict()
export const adminAppointmentQuerySchema = filterBase.extend({ status: z.enum(['pending', 'approved', 'rescheduled', 'completed', 'cancelled']).optional() }).strict()
export const adminCounterQuerySchema = pagination.extend({ departmentId: objectId.optional(), status: z.enum(['active', 'available', 'busy', 'inactive', 'maintenance']).optional(), search: z.string().trim().max(100).optional() }).strict()
export const adminDepartmentQuerySchema = pagination.extend({ search: z.string().trim().max(100).optional(), isActive: z.enum(['true', 'false']).optional() }).strict()
export const adminDateRangeQuerySchema = z.object({ from: dateOnly.optional(), to: dateOnly.optional(), departmentId: objectId.optional() }).strict().refine((value) => (!value.from || !Number.isNaN(Date.parse(`${value.from}T00:00:00Z`))) && (!value.to || !Number.isNaN(Date.parse(`${value.to}T00:00:00Z`))), 'Dates must be valid calendar dates.').refine((value) => !value.from || !value.to || value.from <= value.to, 'Start date must not be after end date.')
export const activityQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), entityType: z.enum(['token', 'counter', 'appointment', 'department', 'settings', 'queue']).optional() }).strict()
export const adminInsightQuerySchema = z.object({ departmentId: objectId.optional() }).strict()

const hoursSchema = z.array(z.object({
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  opensAt: timeOnly,
  closesAt: timeOnly,
  isClosed: z.boolean().default(false),
}).strict().refine((value) => value.isClosed || value.opensAt < value.closesAt, { message: 'Closing time must be later than opening time.' })).max(7)

export const departmentCreateSchema = z.object({
  name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(), workingHours: hoursSchema.optional(),
}).strict()
export const departmentPatchSchema = departmentCreateSchema.partial().refine((value) => Object.keys(value).length > 0, 'Provide a department field to update.')

export const counterCreateSchema = z.object({
  name: z.string().trim().min(2).max(120), counterNumber: z.string().trim().min(1).max(32), departmentId: objectId,
  status: z.enum(['active', 'available', 'inactive', 'maintenance']).default('available'),
}).strict()
export const counterPatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(), counterNumber: z.string().trim().min(1).max(32).optional(),
  departmentId: objectId.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide counter details to update.')
export const counterStatusSchema = z.object({ status: z.enum(['active', 'available', 'inactive', 'maintenance']) }).strict()

export const tokenStatusSchema = z.object({ status: z.enum(['serving', 'completed', 'skipped', 'cancelled']), note: z.string().trim().max(300).optional() }).strict()
export const callTokenSchema = z.object({ counterId: objectId.optional() }).strict()
export const walkInRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(8).max(24).regex(/^\+?[\d\s()-]+$/),
  departmentId: objectId,
  counterId: objectId,
}).strict()
export const queueSettingsSchema = z.object({
  maxDailyTokens: z.number().int().min(1).max(10000).optional(), priorityEnabled: z.boolean().optional(),
  showEstimatedWaitingTime: z.boolean().optional(), autoCallNext: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide a queue setting to update.')

export const appointmentAdminStatusSchema = z.object({ status: z.enum(['approved', 'rescheduled', 'completed', 'cancelled']), note: z.string().trim().max(500).optional() }).strict()
export const appointmentRescheduleSchema = z.object({ appointmentDate: dateOnly, appointmentTime: timeOnly, note: z.string().trim().max(500).optional() }).strict()

export const settingsPatchSchema = z.object({
  hospitalName: z.string().trim().min(2).max(160).optional(), address: z.string().trim().max(500).optional(),
  contactNumber: z.string().trim().min(8).max(24).regex(/^\+?[\d\s()-]+$/).optional(), email: z.string().trim().email().max(254).optional(),
  workingHours: hoursSchema.optional(), tokenPrefix: z.string().trim().regex(/^[A-Za-z0-9]{1,8}$/).optional(),
  maxDailyTokens: z.number().int().min(1).max(10000).optional(), priorityQueueEnabled: z.boolean().optional(),
  showEstimatedWaitingTime: z.boolean().optional(), autoCallNext: z.boolean().optional(), sessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide a settings field to update.')

export const adminProfilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phoneNumber: z.string().trim().min(8).max(24).regex(/^\+?[\d\s()-]+$/).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide a profile field to update.')
export const adminNotificationPreferencesSchema = z.object({
  newAppointments: z.boolean(), cancellations: z.boolean(), delays: z.boolean(), dailySummary: z.boolean(),
}).strict()

export type AdminTokenFilters = z.infer<typeof adminTokenQuerySchema>
export type AdminAppointmentFilters = z.infer<typeof adminAppointmentQuerySchema>
export type AdminCounterFilters = z.infer<typeof adminCounterQuerySchema>
export type AdminDepartmentFilters = z.infer<typeof adminDepartmentQuerySchema>
export type AdminDateRangeFilters = z.infer<typeof adminDateRangeQuerySchema>
