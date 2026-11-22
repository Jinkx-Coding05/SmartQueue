import type {
  AuthApiUser,
  AuthSessionResponse,
  ForgotPasswordResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  VerifyOtpRequest,
} from '../../types/authApi'
import { apiRequest } from './http'

export { ApiError as AuthApiError } from './http'

export function register(request: RegisterRequest): Promise<RegisterResponse> {
  return apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(request) })
}

export function login(request: LoginRequest): Promise<AuthSessionResponse> {
  return apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(request) })
}

export function getCurrentUser(accessToken: string): Promise<{ user: AuthApiUser }> {
  return apiRequest('/auth/me', { method: 'GET' }, accessToken)
}

export function logout(accessToken: string): Promise<{ status: 'success'; message: string }> {
  return apiRequest('/auth/logout', { method: 'POST' }, accessToken)
}

export function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  return apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
}

export function resetPassword(request: ResetPasswordRequest): Promise<{ status: 'success'; message: string }> {
  return apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(request) })
}

export function changePassword(request: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ status: 'success'; message: string }> {
  return apiRequest('/auth/change-password', { method: 'PATCH', body: JSON.stringify(request) })
}

export function verifyOtp(request: VerifyOtpRequest): Promise<{ user: AuthApiUser }> {
  return apiRequest('/auth/verify-otp', { method: 'POST', body: JSON.stringify(request) })
}

export function resendOtp(email: string): Promise<{ status: 'success'; message: string; developmentOnlyOtp?: string }> {
  return apiRequest('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) })
}
