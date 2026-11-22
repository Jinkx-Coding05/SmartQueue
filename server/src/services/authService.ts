import bcrypt from 'bcryptjs'
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import type { UserRole } from '../models/sharedEnums.ts'
import { env } from '../config/env.ts'
import type { AuthRepository, UserRecord } from './authRepository.ts'
import { isDuplicateKeyError, mongooseAuthRepository } from './authRepository.ts'
import { normalizeEmail, normalizePhone, type LoginInput, type RegistrationInput } from './authValidation.ts'
import { ResendOtpDeliveryProvider, UnconfiguredOtpDeliveryProvider, type OtpDeliveryProvider } from './otpDelivery.ts'

export type SafeUser = Pick<UserRecord, 'id' | 'fullName' | 'email' | 'phoneNumber' | 'role' | 'accountStatus' | 'createdAt'>
export type AuthContext = { userId: string; role: UserRole; tokenId: string; expiresAt: number; issuedAt: number; user: SafeUser }
export type AuthServiceOptions = {
  secret?: string
  accessTokenTtlSeconds?: number
  resetTokenTtlMinutes?: number
  otpTtlMinutes?: number
  exposeDevelopmentOtp?: boolean
  runtimeEnvironment?: string
  otpMaxAttempts?: number
  otpResendCooldownSeconds?: number
  repository?: AuthRepository
  otpProvider?: OtpDeliveryProvider
}

export class AuthError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

export class AuthService {
  private readonly repository: AuthRepository
  private readonly secret: string
  private readonly accessTokenTtlSeconds: number
  private readonly resetTokenTtlMinutes: number
  private readonly otpTtlMinutes: number
  private readonly exposeDevelopmentOtp: boolean
  private readonly otpMaxAttempts: number
  private readonly otpResendCooldownSeconds: number
  private readonly otpProvider: OtpDeliveryProvider

  constructor(options: AuthServiceOptions = {}) {
    this.repository = options.repository ?? mongooseAuthRepository
    this.secret = options.secret ?? env.jwtSecret
    this.accessTokenTtlSeconds = options.accessTokenTtlSeconds ?? env.jwtTtlSeconds
    this.resetTokenTtlMinutes = options.resetTokenTtlMinutes ?? env.resetTokenTtlMinutes
    this.otpTtlMinutes = options.otpTtlMinutes ?? env.otpTtlMinutes
    const runtimeEnvironment = options.runtimeEnvironment ?? env.nodeEnv
    this.exposeDevelopmentOtp = runtimeEnvironment === 'development' && (options.exposeDevelopmentOtp ?? env.devOtpExpose)
    this.otpMaxAttempts = options.otpMaxAttempts ?? env.otpMaxAttempts
    this.otpResendCooldownSeconds = options.otpResendCooldownSeconds ?? env.otpResendCooldownSeconds
    this.otpProvider = options.otpProvider ?? (env.resendApiKey && env.otpFromEmail ? new ResendOtpDeliveryProvider() : new UnconfiguredOtpDeliveryProvider())
  }

  async register(input: RegistrationInput) {
    const email = normalizeEmail(input.email)
    const phoneNumber = normalizePhone(input.phone)
    if (!/^\+?[1-9]\d{7,14}$/.test(phoneNumber)) throw new AuthError('Enter a valid international phone number.', 400)
    if (!isValidEmail(email)) throw new AuthError('Registration details are invalid.', 400)
    if (await this.repository.findByEmailOrPhone(email, phoneNumber)) throw new AuthError('Unable to create an account with those details.', 400)

    const passwordHash = await bcrypt.hash(input.password, 12)
    try {
      const user = await this.repository.createUser({ fullName: input.fullName.trim(), email, phoneNumber, passwordHash, passwordChangedAt: new Date(), role: 'citizen', emailVerified: false })
      const verificationCode = await this.createVerificationCode(email)
      if (!verificationCode) throw new AuthError('Verification could not be started. Please try again later.', 503)
      return {
        user: toSafeUser(user),
        verificationRequired: true as const,
        deliveryConfigured: verificationCode.deliveryMethod === 'email',
          ...(verificationCode.developmentOnlyOtp ? { developmentOnlyOtp: verificationCode.developmentOnlyOtp } : {}),
      }
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AuthError('Unable to create an account with those details.', 400)
      throw error
    }
  }

  async login(input: LoginInput) {
    const email = normalizeEmail(input.email)
    const user = await this.repository.findForLogin(email)
    const passwordHash = user?.passwordHash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEe.6P7bQ1jlyfY2I3vJ5FlhXycYzaZJz9W'
    const passwordMatches = await bcrypt.compare(input.password, passwordHash)
    if (!user || !passwordMatches || user.accountStatus !== 'active' || !user.emailVerified) {
      throw new AuthError('Invalid email or password.', 401)
    }

    const safeUser = toSafeUser(user)
    const tokenId = randomUUID()
    const accessToken = jwt.sign({ role: safeUser.role }, this.secret, {
      algorithm: 'HS256',
      audience: 'smartqueue-ai-api',
      expiresIn: this.accessTokenTtlSeconds,
      issuer: 'smartqueue-ai',
      jwtid: tokenId,
      subject: safeUser.id,
    })
    return { user: safeUser, accessToken, expiresIn: this.accessTokenTtlSeconds }
  }

  async authenticate(token: string): Promise<AuthContext> {
    let decoded: string | JwtPayload
    try {
      decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'], audience: 'smartqueue-ai-api', issuer: 'smartqueue-ai' })
    } catch {
      throw new AuthError('Authentication token is invalid or expired.', 401)
    }
    if (typeof decoded === 'string' || !decoded.sub || !decoded.jti || !decoded.exp || !decoded.iat || (decoded.role !== 'citizen' && decoded.role !== 'admin')) {
      throw new AuthError('Authentication token is invalid or expired.', 401)
    }
    if (await this.repository.isTokenRevoked(decoded.jti)) throw new AuthError('Authentication token is invalid or expired.', 401)

    const user = await this.repository.findById(decoded.sub)
    if (!user || user.accountStatus !== 'active' || user.role !== decoded.role || (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000))) {
      throw new AuthError('Authentication token is invalid or expired.', 401)
    }
    return { userId: user.id, role: user.role, tokenId: decoded.jti, expiresAt: decoded.exp, issuedAt: decoded.iat, user: toSafeUser(user) }
  }

  async logout(context: AuthContext) {
    await this.repository.revokeToken(context.tokenId, new Date(context.expiresAt * 1000))
  }

  async resendVerificationCode(emailInput: string) {
    const email = normalizeEmail(emailInput)
    if (!isValidEmail(email)) throw new AuthError('Enter a valid email address.', 400)
    const user = await this.repository.findByEmail(email)
    if (!user || user.emailVerified) return { deliveryConfigured: false as const }
    const result = await this.createVerificationCode(email)
    return { deliveryConfigured: result?.deliveryMethod === 'email', ...(result?.developmentOnlyOtp ? { developmentOnlyOtp: result.developmentOnlyOtp } : {}) }
  }

  async verifyEmail(emailInput: string, code: string) {
    const email = normalizeEmail(emailInput)
    if (!isValidEmail(email)) throw new AuthError('Verification code is invalid or expired.', 400)
    const now = new Date()
    if (!/^\d{6}$/.test(code)) {
      await this.repository.incrementVerificationAttempts(email, now, this.otpMaxAttempts)
      throw new AuthError('Verification code is invalid or expired.', 400)
    }
    const user = await this.repository.consumeVerificationCode(email, hashVerificationCode(code, this.secret), now, this.otpMaxAttempts)
    if (!user) {
      await this.repository.incrementVerificationAttempts(email, now, this.otpMaxAttempts)
      throw new AuthError('Verification code is invalid or expired.', 400)
    }
    return toSafeUser(user)
  }

  isDevelopmentOtpExposureEnabled() {
    return this.exposeDevelopmentOtp
  }

  async forgotPassword(emailInput: string) {
    const email = normalizeEmail(emailInput)
    if (!isValidEmail(email)) throw new AuthError('Enter a valid email address.', 400)
    const user = await this.repository.findByEmail(email)
    if (!user) return null
    const token = randomBytes(32).toString('base64url')
    const tokenHash = hashResetToken(token)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.resetTokenTtlMinutes * 60_000)
    const saved = await this.repository.saveResetToken(email, tokenHash, expiresAt, now, new Date(now.getTime() - this.otpResendCooldownSeconds * 1000))
    if (!saved) return null
    if (env.nodeEnv === 'development' && env.exposeResetToken) return token
    try {
      await this.otpProvider.sendPasswordReset(email, token, expiresAt, this.resetTokenTtlMinutes)
    } catch {
      await this.repository.invalidateResetToken(email)
      throw new AuthError('Email delivery is temporarily unavailable. Please try again later.', 503)
    }
    return token
  }

  async resetPassword(token: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12)
    const changed = await this.repository.consumeResetToken(hashResetToken(token), passwordHash, new Date())
    if (!changed) throw new AuthError('Password reset token is invalid or expired.', 400)
  }

  async changePassword(context: AuthContext, currentPassword: string, newPassword: string) {
    const user = await this.repository.findForPasswordChange(context.userId)
    if (!user?.passwordHash || !await bcrypt.compare(currentPassword, user.passwordHash)) throw new AuthError('Current password is incorrect.', 400)
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new AuthError('Choose a password different from your current password.', 400)
    const changedAt = new Date((Math.floor(Date.now() / 1000) + 1) * 1000)
    if (!await this.repository.setPassword(context.userId, await bcrypt.hash(newPassword, 12), changedAt)) throw new AuthError('Password could not be updated. Try again.', 409)
    await this.repository.revokeToken(context.tokenId, new Date(context.expiresAt * 1000))
  }

  async provisionAdmin(input: { fullName: string; email: string; phone: string; password: string }) {
    const email = normalizeEmail(input.email)
    const phoneNumber = normalizePhone(input.phone)
    const existing = await this.repository.findByEmail(email)
    if (existing?.role === 'admin') return toSafeUser(existing)
    if (existing) throw new AuthError('The configured admin email belongs to a non-admin account.', 409)
    if (!/^\+?[1-9]\d{7,14}$/.test(phoneNumber)) throw new AuthError('ADMIN_PHONE must be a valid international phone number.', 400)
    if (await this.repository.findByEmailOrPhone(email, phoneNumber)) {
      throw new AuthError('An account with the configured admin email or phone already exists.', 409)
    }
    try {
      const user = await this.repository.createUser({
        fullName: input.fullName.trim(),
        email,
        phoneNumber,
        passwordHash: await bcrypt.hash(input.password, 12),
        passwordChangedAt: new Date(),
        role: 'admin',
        emailVerified: true,
      })
      return toSafeUser(user)
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new AuthError('An account with the configured admin email or phone already exists.', 409)
      throw error
    }
  }

  async provisionCitizen(input: RegistrationInput, demoSeedKey?: string) {
    const email = normalizeEmail(input.email)
    const phoneNumber = normalizePhone(input.phone)
    if (!/^\+?[1-9]\d{7,14}$/.test(phoneNumber)) throw new AuthError('CITIZEN_PHONE must be a valid international phone number.', 400)
    if (await this.repository.findByEmailOrPhone(email, phoneNumber)) return { created: false as const }

    try {
      await this.repository.createUser({
        fullName: input.fullName.trim(),
        email,
        phoneNumber,
        passwordHash: await bcrypt.hash(input.password, 12),
        passwordChangedAt: new Date(),
        role: 'citizen',
        emailVerified: true,
        ...(demoSeedKey ? { demoSeedKey } : {}),
      })
      return { created: true as const }
    } catch (error) {
      if (isDuplicateKeyError(error)) return { created: false as const }
      throw error
    }
  }

  private async createVerificationCode(email: string): Promise<{ developmentOnlyOtp?: string; deliveryMethod: 'development' | 'email' } | null> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    if (!isValidEmail(email)) throw new AuthError('Enter a valid email address.', 400)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.otpTtlMinutes * 60_000)
    const saved = await this.repository.saveVerificationCode(email, hashVerificationCode(code, this.secret), expiresAt, now, new Date(now.getTime() - this.otpResendCooldownSeconds * 1000))
    if (!saved) return null
    if (this.exposeDevelopmentOtp) return { developmentOnlyOtp: code, deliveryMethod: 'development' as const }
    try {
      await this.otpProvider.sendCode(email, code, 'email verification', expiresAt, this.otpTtlMinutes)
    } catch {
      await this.repository.invalidateVerificationCode(email)
      throw new AuthError('Email delivery is temporarily unavailable. Please try again later.', 503)
    }
    return { developmentOnlyOtp: undefined, deliveryMethod: 'email' as const }
  }
}

export const authService = new AuthService()

export function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function hashVerificationCode(code: string, secret: string) {
  return createHmac('sha256', secret).update(code).digest('hex')
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
  }
}
