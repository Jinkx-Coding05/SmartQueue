import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict()

export const profilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phoneNumber: z.string().trim().min(8).max(24).regex(/^\+?[\d\s()-]+$/).optional(),
  dateOfBirth: dateOnly.optional(),
  gender: z.enum(['Female', 'Male', 'Non-binary', 'Prefer not to say']).or(z.literal('')).optional(),
  profileImage: z.string().trim().max(2048).url().or(z.literal('')).optional(),
  address: z.object({
    address: z.string().trim().max(300).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    pinCode: z.string().trim().regex(/^\d{6}$/).optional(),
  }).strict().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one profile field to update.')

export const createTokenSchema = z.object({
  departmentId: z.string().length(24).regex(/^[\da-f]+$/i),
  preferredVisitDate: dateOnly.optional(),
  preferredTime: timeOnly.optional(),
  visitType: z.enum(['New Consultation', 'Follow-up', 'Emergency']).optional(),
}).strict().refine((value) => {
  const supplied = [value.preferredVisitDate, value.preferredTime, value.visitType].filter((item) => item !== undefined).length
  return supplied === 0 || supplied === 3
}, 'Provide date, time, and visit type together.')

export const createAppointmentSchema = z.object({
  departmentId: z.string().length(24).regex(/^[\da-f]+$/i),
  appointmentDate: dateOnly,
  appointmentTime: timeOnly,
  notes: z.string().trim().max(2000).optional(),
}).strict()

export const patchAppointmentSchema = z.object({
  appointmentDate: dateOnly.optional(),
  appointmentTime: timeOnly.optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one appointment field to update.')

export const createDocumentSchema = z.object({
  documentType: z.string().trim().min(2).max(120),
  fileMetadata: z.object({
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
    sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
  }).strict(),
}).strict()

export const notificationPageQuerySchema = pageQuery.extend({ unreadOnly: z.enum(['true', 'false']).optional() }).strict()
export const pageQuerySchema = pageQuery

export type ProfilePatch = z.infer<typeof profilePatchSchema>
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type CreateTokenInput = z.infer<typeof createTokenSchema>
export type PatchAppointmentInput = z.infer<typeof patchAppointmentSchema>
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type PaginationInput = z.infer<typeof pageQuerySchema>
