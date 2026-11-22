import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), 'server', '.env') })

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: process.env.MONGODB_URI?.trim() ?? '',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  clientUrls: [...new Set([process.env.CLIENT_URL ?? 'http://localhost:5173', ...(process.env.CLIENT_URLS ?? '').split(',')].map((value) => value.trim()).filter(Boolean))],
  hospitalTimeZone: process.env.HOSPITAL_TIME_ZONE ?? 'Asia/Kolkata',
  defaultServiceDurationMinutes: Number(process.env.DEFAULT_SERVICE_DURATION_MINUTES ?? 2),
  citizenArrivalBufferMinutes: Number(process.env.CITIZEN_ARRIVAL_BUFFER_MINUTES ?? 15),
  jwtSecret: process.env.JWT_SECRET?.trim() ?? '',
  jwtTtlSeconds: Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 900),
  resetTokenTtlMinutes: Number(process.env.AUTH_RESET_TOKEN_TTL_MINUTES ?? 15),
  exposeResetToken: process.env.AUTH_RESET_TOKEN_EXPOSE === 'true',
  otpTtlMinutes: Number(process.env.AUTH_OTP_TTL_MINUTES ?? 10),
  devOtpExpose: process.env.DEV_OTP_EXPOSE === 'true',
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
  otpFromEmail: process.env.OTP_FROM_EMAIL?.trim() ?? '',
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 900_000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
  adminName: process.env.ADMIN_FULL_NAME?.trim() ?? '',
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '',
  adminPhone: process.env.ADMIN_PHONE?.trim() ?? '',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  citizenName: process.env.CITIZEN_FULL_NAME?.trim() ?? '',
  citizenEmail: process.env.CITIZEN_EMAIL?.trim().toLowerCase() ?? '',
  citizenPhone: process.env.CITIZEN_PHONE?.trim() ?? '',
  citizenPassword: process.env.CITIZEN_PASSWORD ?? '',
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 30000),
  geminiCacheTtlMs: Number(process.env.GEMINI_CACHE_TTL_MS ?? 120_000),
  geminiRateLimitWindowMs: Number(process.env.GEMINI_RATE_LIMIT_WINDOW_MS ?? 60_000),
  geminiRateLimitMax: Number(process.env.GEMINI_RATE_LIMIT_MAX ?? 12),
}

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}

if (!Number.isFinite(env.defaultServiceDurationMinutes) || env.defaultServiceDurationMinutes <= 0 || env.defaultServiceDurationMinutes > 240) {
  throw new Error('DEFAULT_SERVICE_DURATION_MINUTES must be greater than 0 and at most 240.')
}
if (!Number.isInteger(env.citizenArrivalBufferMinutes) || env.citizenArrivalBufferMinutes < 0 || env.citizenArrivalBufferMinutes > 180) {
  throw new Error('CITIZEN_ARRIVAL_BUFFER_MINUTES must be an integer from 0 to 180.')
}

try {
  for (const allowedUrl of env.clientUrls) {
    const clientUrl = new URL(allowedUrl)
    if (clientUrl.protocol !== 'http:' && clientUrl.protocol !== 'https:') throw new Error()
  }
} catch {
  throw new Error('CLIENT_URL and CLIENT_URLS must contain valid HTTP or HTTPS origins.')
}

if (env.mongodbUri && !env.mongodbUri.startsWith('mongodb+srv://')) {
  throw new Error('MONGODB_URI must be a MongoDB Atlas SRV URI beginning with mongodb+srv://.')
}

try {
  new Intl.DateTimeFormat('en-US', { timeZone: env.hospitalTimeZone }).format(new Date())
} catch {
  throw new Error('HOSPITAL_TIME_ZONE must be a valid IANA time-zone name.')
}

if (!env.jwtSecret || Buffer.byteLength(env.jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 bytes in server/.env.')
}

if (!Number.isInteger(env.jwtTtlSeconds) || env.jwtTtlSeconds < 60 || env.jwtTtlSeconds > 3600) {
  throw new Error('AUTH_TOKEN_TTL_SECONDS must be an integer between 60 and 3600.')
}

if (!Number.isInteger(env.resetTokenTtlMinutes) || env.resetTokenTtlMinutes < 5 || env.resetTokenTtlMinutes > 60) {
  throw new Error('AUTH_RESET_TOKEN_TTL_MINUTES must be an integer between 5 and 60.')
}

if (!Number.isInteger(env.authRateLimitWindowMs) || env.authRateLimitWindowMs < 60_000 || !Number.isInteger(env.authRateLimitMax) || env.authRateLimitMax < 1) {
  throw new Error('Authentication rate-limit settings must use a window of at least 60000 ms and a positive request limit.')
}

if ((env.exposeResetToken || env.devOtpExpose) && env.nodeEnv !== 'development') {
  throw new Error('AUTH_RESET_TOKEN_EXPOSE and DEV_OTP_EXPOSE are allowed only when NODE_ENV=development.')
}

if (!Number.isInteger(env.otpResendCooldownSeconds) || env.otpResendCooldownSeconds < 30 || env.otpResendCooldownSeconds > 900) {
  throw new Error('OTP_RESEND_COOLDOWN_SECONDS must be an integer from 30 to 900.')
}
if (!Number.isInteger(env.otpMaxAttempts) || env.otpMaxAttempts < 3 || env.otpMaxAttempts > 10) {
  throw new Error('OTP_MAX_ATTEMPTS must be an integer from 3 to 10.')
}
const otpFromAddress = env.otpFromEmail.match(/^(?:[^<>]+\s)?<([^<>]+)>$/)?.[1] ?? env.otpFromEmail
if (otpFromAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpFromAddress)) {
  throw new Error('OTP_FROM_EMAIL must be a valid sender email address, optionally formatted as Name <email>.')
}
if (env.nodeEnv === 'production') {
  if (!/^re_[A-Za-z0-9_-]{16,}$/.test(env.resendApiKey)) throw new Error('RESEND_API_KEY must be configured for production email delivery.')
  if (!otpFromAddress || otpFromAddress.toLowerCase().endsWith('@resend.dev')) throw new Error('OTP_FROM_EMAIL must use an address on your verified Resend domain in production.')
}

if (!Number.isInteger(env.otpTtlMinutes) || env.otpTtlMinutes < 5 || env.otpTtlMinutes > 30) {
  throw new Error('AUTH_OTP_TTL_MINUTES must be an integer between 5 and 30.')
}

if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,99}$/.test(env.geminiModel)) {
  throw new Error('GEMINI_MODEL must be a valid Gemini model identifier.')
}

if (!Number.isInteger(env.geminiTimeoutMs) || env.geminiTimeoutMs < 1000 || env.geminiTimeoutMs > 30000) {
  throw new Error('GEMINI_TIMEOUT_MS must be an integer between 1000 and 30000.')
}

if (!Number.isInteger(env.geminiCacheTtlMs) || env.geminiCacheTtlMs < 1000 || env.geminiCacheTtlMs > 3600000) {
  throw new Error('GEMINI_CACHE_TTL_MS must be an integer between 1000 and 3600000.')
}

if (!Number.isInteger(env.geminiRateLimitWindowMs) || env.geminiRateLimitWindowMs < 1000 || !Number.isInteger(env.geminiRateLimitMax) || env.geminiRateLimitMax < 1) {
  throw new Error('Gemini rate-limit settings must use a positive request limit and a window of at least 1000 ms.')
}
