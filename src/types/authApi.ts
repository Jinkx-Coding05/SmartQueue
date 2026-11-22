import type { UserRole } from './auth'

export type AuthApiUser = {
  id: string
  fullName: string
  email: string
  phoneNumber: string
  role: UserRole
  accountStatus: 'active' | 'inactive' | 'suspended'
  createdAt: string
}

export type RegisterRequest = {
  fullName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

export type LoginRequest = { email: string; password: string }
export type RegisterResponse = { user: AuthApiUser; verificationRequired: true; deliveryConfigured: boolean; debugVerificationCode?: string }
export type ResetPasswordRequest = { token: string; password: string; confirmPassword: string }
export type VerifyOtpRequest = { email: string; code: string }
export type AuthSessionResponse = { user: AuthApiUser; accessToken: string; expiresIn: number }
export type ForgotPasswordResponse = { status: 'success'; message: string; debugResetToken?: string }
