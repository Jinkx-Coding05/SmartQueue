import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), 'server', '.env') })

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: process.env.MONGODB_URI?.trim() ?? '',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  hospitalTimeZone: process.env.HOSPITAL_TIME_ZONE ?? 'Asia/Kolkata',
  jwtSecret: process.env.JWT_SECRET?.trim() ?? '',
  jwtTtlSeconds: Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 900),
  resetTokenTtlMinutes: Number(process.env.AUTH_RESET_TOKEN_TTL_MINUTES ?? 15),
  exposeResetToken: process.env.AUTH_RESET_TOKEN_EXPOSE === 'true',
  otpTtlMinutes: Number(process.env.AUTH_OTP_TTL_MINUTES ?? 10),
  exposeOtp: process.env.AUTH_OTP_EXPOSE === 'true',
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

try {
  const clientUrl = new URL(env.clientUrl)
  if (clientUrl.protocol !== 'http:' && clientUrl.protocol !== 'https:') throw new Error()
} catch {
  throw new Error('CLIENT_URL must be a valid HTTP or HTTPS origin.')
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

if ((env.exposeResetToken || env.exposeOtp) && env.nodeEnv !== 'development') {
  throw new Error('AUTH_RESET_TOKEN_EXPOSE and AUTH_OTP_EXPOSE are allowed only when NODE_ENV=development.')
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
