import type { RequestHandler } from 'express'
import { env } from '../config/env.ts'
import { AuthError, type AuthService } from '../services/authService.ts'
import {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  resendVerificationBodySchema,
  registrationBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from '../services/authValidation.ts'

export function createAuthController(service: AuthService) {
  const register: RequestHandler = async (request, response, next) => {
    const parsed = registrationBodySchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ status: 'error', message: 'Registration details are invalid.', errors: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) })
      return
    }
    try {
      const result = await service.register(parsed.data)
      const { debugVerificationCode, ...publicResult } = result
      response.status(201).json({
        status: 'success',
        message: result.deliveryConfigured ? 'Account created. Check your email for the verification code.' : 'Account created. Verification delivery is not configured yet.',
        data: {
          ...publicResult,
          ...(env.nodeEnv === 'development' && env.exposeOtp && debugVerificationCode ? { debugVerificationCode } : {}),
        },
      })
    } catch (error) { next(error) }
  }

  const login: RequestHandler = async (request, response, next) => {
    const parsed = loginBodySchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ status: 'error', message: 'Login details are invalid.', errors: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) })
      return
    }
    try {
      const result = await service.login(parsed.data)
      response.json({ status: 'success', data: result })
    } catch (error) { next(error) }
  }

  const me: RequestHandler = (request, response) => {
    if (!request.user) throw new AuthError('Authentication is required.', 401)
    response.json({ status: 'success', data: { user: request.user } })
  }

  const logout: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) throw new AuthError('Authentication is required.', 401)
      await service.logout(request.auth)
      response.json({ status: 'success', message: 'Logged out successfully. Clear the access token from the client.' })
    } catch (error) { next(error) }
  }

  const changePassword: RequestHandler = async (request, response, next) => {
    const parsed = changePasswordBodySchema.safeParse(request.body)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Password details are invalid.', errors: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) }); return }
    try {
      if (!request.auth) { response.status(401).json({ status: 'error', message: 'Authentication is required.' }); return }
      await service.changePassword(request.auth, parsed.data.currentPassword, parsed.data.newPassword)
      response.json({ status: 'success', message: 'Password changed. All existing sessions have been revoked; sign in again.' })
    } catch (error) { next(error) }
  }

  const forgotPassword: RequestHandler = async (request, response, next) => {
    const parsed = forgotPasswordBodySchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ status: 'error', message: 'Enter a valid email address.' })
      return
    }
    try {
      const resetToken = await service.forgotPassword(parsed.data.email)
      const result: { status: string; message: string; debugResetToken?: string } = {
        status: 'success',
        message: 'If an account exists for this email, password reset instructions will be available through the configured delivery provider.',
      }
      if (env.nodeEnv === 'development' && env.exposeResetToken && resetToken) result.debugResetToken = resetToken
      response.status(202).json(result)
    } catch (error) { next(error) }
  }

  const resetPassword: RequestHandler = async (request, response, next) => {
    const parsed = resetPasswordBodySchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ status: 'error', message: 'Password reset details are invalid.', errors: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) })
      return
    }
    try {
      await service.resetPassword(parsed.data.token, parsed.data.password)
      response.json({ status: 'success', message: 'Password reset successfully. Sign in with your new password.' })
    } catch (error) { next(error) }
  }

  const verifyEmail: RequestHandler = async (request, response, next) => {
    const parsed = verifyEmailBodySchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ status: 'error', message: 'Enter a valid email address and six-digit verification code.' })
      return
    }
    try {
      const user = await service.verifyEmail(parsed.data.email, parsed.data.code)
      response.json({ status: 'success', data: { user } })
    } catch (error) { next(error) }
  }

  const resendVerification: RequestHandler = async (request, response, next) => {
    const parsed = resendVerificationBodySchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ status: 'error', message: 'Enter a valid email address.' })
      return
    }
    try {
      const debugVerificationCode = await service.resendVerificationCode(parsed.data.email)
      const result: { status: string; message: string; debugVerificationCode?: string } = {
        status: 'success',
        message: 'If the account requires verification, a code will be delivered when a provider is configured.',
      }
      if (env.nodeEnv === 'development' && env.exposeOtp && debugVerificationCode) result.debugVerificationCode = debugVerificationCode
      response.status(202).json(result)
    } catch (error) { next(error) }
  }

  return { register, login, me, logout, changePassword, forgotPassword, resetPassword, verifyEmail, resendVerification }
}
