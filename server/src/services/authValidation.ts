import { z } from 'zod'

const strongPassword = z.string()
  .min(10, 'Password must be at least 10 characters.')
  .max(72, 'Password must not exceed 72 characters.')
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, 'Password must not exceed 72 UTF-8 bytes.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.')

export const registrationBodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(8).max(24).regex(/^\+?[\d\s()-]+$/),
  password: strongPassword,
  confirmPassword: z.string(),
}).strict().refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
})

export const loginBodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
}).strict()

export const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email().max(254),
}).strict()

export const verifyEmailBodySchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().regex(/^\d{6}$/),
}).strict()

export const resendVerificationBodySchema = forgotPasswordBodySchema

export const resetPasswordBodySchema = z.object({
  token: z.string().min(32).max(128),
  password: strongPassword,
  confirmPassword: z.string(),
}).strict().refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
})

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: strongPassword,
  confirmPassword: z.string(),
}).strict().refine((data) => data.newPassword === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })

export type RegistrationInput = z.infer<typeof registrationBodySchema>
export type LoginInput = z.infer<typeof loginBodySchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordBodySchema>

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizePhone(phone: string) {
  return phone.replace(/[\s()-]/g, '')
}
