import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import express from 'express'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import { createAuthenticationMiddleware, requireAdmin, requireCitizen } from '../server/src/middleware/auth.ts'
import { errorHandler } from '../server/src/middleware/errorHandler.ts'
import { AuthService } from '../server/src/services/authService.ts'
import { createAuthRouter } from '../server/src/routes/authRoutes.ts'
import { ResendOtpDeliveryProvider } from '../server/src/services/otpDelivery.ts'

const servers = new Set()
const strongPassword = 'StrongPass!234'

after(async () => {
  await Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve))))
})

test('registration hashes password, assigns citizen role, and rejects duplicates and invalid/admin input', async () => {
  const { service, request } = await createTestApi()
  const body = registration({})
  const created = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) })
  assert.equal(created.status, 201)
  assert.equal(created.data.user.role, 'citizen')
  assert.equal('passwordHash' in created.data.user, false)
  const record = service.repository.users[0]
  assert.notEqual(record.passwordHash, strongPassword)
  assert.equal(await bcrypt.compare(strongPassword, record.passwordHash), true)
  assert.equal(record.emailVerified, false)

  const duplicateEmail = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...body, phone: '+919000000002' }) })
  assert.equal(duplicateEmail.status, 400)
  const duplicatePhone = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...body, email: 'other@example.test' }) })
  assert.equal(duplicatePhone.status, 400)
  const invalid = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...body, password: 'weak', confirmPassword: 'weak', role: 'admin' }) })
  assert.equal(invalid.status, 400)
  assert.equal(service.repository.users.length, 1)
})

test('development OTP appears in the API only when explicitly enabled, and is never exposed for production runtime', async () => {
  const enabled = await createTestApi({ exposeDevelopmentOtp: true })
  const exposed = await enabled.request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  assert.match(exposed.data.developmentOnlyOtp, /^\d{6}$/)
  assert.equal('debugVerificationCode' in exposed.data, false)
  assert.notEqual(enabled.service.repository.users[0].verificationCodeHash, exposed.data.developmentOnlyOtp)
  assert.equal(enabled.mailer.sentCodes.length, 0)

  const disabled = await createTestApi({ exposeDevelopmentOtp: false })
  const emailed = await disabled.request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  assert.equal('developmentOnlyOtp' in emailed.data, false)
  assert.equal(disabled.mailer.sentCodes.length, 1)
  assert.match(disabled.mailer.sentCodes[0].code, /^\d{6}$/)
  assert.notEqual(disabled.service.repository.users[0].verificationCodeHash, disabled.mailer.sentCodes[0].code)

  const production = await createTestApi({ runtimeEnvironment: 'production', exposeDevelopmentOtp: true })
  const sent = await production.request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  assert.equal('developmentOnlyOtp' in sent.data, false)
  assert.equal(production.mailer.sentCodes.length, 1)
})

test('official Resend provider sends HTML and plain-text verification and reset messages and confirms provider acceptance', async () => {
  const messages = []
  const resend = { emails: { send: async (message) => { messages.push(message); return { data: { id: `resend-${messages.length}` }, error: null } } } }
  const provider = new ResendOtpDeliveryProvider('re_test_key_not_real_123456789012', 'SmartQueue AI <otp@example.test>', resend)
  const expiresAt = new Date(Date.now() + 5 * 60_000)
  await provider.sendCode('citizen@example.test', '012345', 'email verification', expiresAt, 5)
  await provider.sendPasswordReset('citizen@example.test', 'a'.repeat(43), expiresAt, 15)
  assert.equal(messages.length, 2)
  assert.equal(messages[0].to[0], 'citizen@example.test')
  assert.equal(messages[0].from, 'SmartQueue AI <otp@example.test>')
  assert.match(messages[0].html, /012345/)
  assert.match(messages[0].text, /012345/)
  assert.match(messages[0].text, /email verification/)
  assert.match(messages[1].text, /password reset/i)
  assert.match(messages[1].html, /\/login\?resetToken=/)

  const providerFailure = new ResendOtpDeliveryProvider('re_test_key_not_real_123456789012', 'SmartQueue AI <otp@example.test>', { emails: { send: async () => ({ data: null, error: { message: 'secret provider payload' } }) } })
  await assert.rejects(() => providerFailure.sendCode('citizen@example.test', '123456', 'email verification', expiresAt, 5), (error) => error.name === 'OtpDeliveryError' && !error.message.includes('secret'))
  const invalidRecipient = new ResendOtpDeliveryProvider('re_test_key_not_real_123456789012', 'SmartQueue AI <otp@example.test>', resend)
  await assert.rejects(() => invalidRecipient.sendCode('bad-address', '123456', 'email verification', expiresAt, 5), /Email delivery could not be completed/)
})

test('missing Resend credentials fail safely and production startup rejects missing email configuration', async () => {
  assert.throws(() => new ResendOtpDeliveryProvider('', ''), (error) => error.name === 'OtpDeliveryError' && !error.message.includes('API key'))
  const { service, request } = await createTestApi({ exposeDevelopmentOtp: false, otpProvider: { sendCode: async () => { throw new Error('provider secret and payload') }, sendPasswordReset: async () => { throw new Error('provider secret and payload') } } })
  const failed = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  assert.equal(failed.status, 503)
  assert.doesNotMatch(failed.body.message, /provider secret|payload|api key/i)
  assert.equal(service.repository.users[0].verificationCodeHash, undefined)

  const script = "process.env.NODE_ENV='production';process.env.JWT_SECRET='test-secret-that-is-long-enough-for-validation';process.env.RESEND_API_KEY='';process.env.OTP_FROM_EMAIL='';await import('./server/src/config/env.ts')"
  const { spawnSync } = await import('node:child_process')
  const check = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, NODE_ENV: 'development' } })
  assert.notEqual(check.status, 0)
  assert.match(check.stderr, /RESEND_API_KEY must be configured/)
  assert.doesNotMatch(check.stderr, /mongodb\+srv:\/\/[^\s]+/)
})

test('invalid, expired, reused and over-attempt OTPs are rejected with hashed storage only', async () => {
  const { service, request } = await createTestApi({ otpMaxAttempts: 3 })
  const registered = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  const code = registered.data.developmentOnlyOtp
  const user = service.repository.users[0]
  const invalid = await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: user.email, code: '999999' }) })
  assert.equal(invalid.status, 400)
  assert.equal(user.verificationCodeAttempts, 1)
  assert.notEqual(user.verificationCodeHash, code)
  await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: user.email, code: '888888' }) })
  await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: user.email, code: '777777' }) })
  assert.equal(user.verificationCodeAttempts, 3)
  assert.equal((await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: user.email, code }) })).status, 400)

  const expired = await createTestApi()
  const newUser = await expired.request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  expired.service.repository.users[0].verificationCodeExpiresAt = new Date(Date.now() - 1)
  assert.equal((await expired.request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', code: newUser.data.developmentOnlyOtp }) })).status, 400)
  assert.equal((await expired.request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', code: newUser.data.developmentOnlyOtp }) })).status, 400)
})

test('OTP resend cooldown is per email, later resend replaces the old code, and only the newest code verifies', async () => {
  const { service, request } = await createTestApi({ otpResendCooldownSeconds: 60 })
  const registered = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  const oldCode = registered.data.developmentOnlyOtp
  const cooling = await service.resendVerificationCode('citizen@example.test')
  assert.equal(cooling.developmentOnlyOtp, undefined)
  service.repository.users[0].verificationCodeIssuedAt = new Date(Date.now() - 61_000)
  const resent = await service.resendVerificationCode('citizen@example.test')
  assert.match(resent.developmentOnlyOtp, /^\d{6}$/)
  assert.notEqual(resent.developmentOnlyOtp, oldCode)
  assert.equal((await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', code: oldCode }) })).status, 400)
  assert.equal((await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', code: resent.developmentOnlyOtp }) })).status, 200)
  assert.equal((await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', code: resent.developmentOnlyOtp }) })).status, 400)
  const missingAccount = await service.resendVerificationCode('absent@example.test')
  assert.equal(missingAccount.developmentOnlyOtp, undefined)
})

test('email reset flow sends a hashed one-time reset token and generic unknown-account response', async () => {
  const { service, mailer, request } = await createTestApi({ exposeDevelopmentOtp: false })
  await service.register(registration({}))
  const known = await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test' }) })
  const unknown = await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'absent@example.test' }) })
  assert.equal(known.status, 202)
  assert.equal(known.body.message, unknown.body.message)
  assert.equal('debugResetToken' in known.body, false)
  assert.equal(mailer.sentResets.length, 1)
  assert.notEqual(service.repository.users[0].passwordResetTokenHash, mailer.sentResets[0].token)
  assert.equal((await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: mailer.sentResets[0].token, password: 'NewStrong!5678', confirmPassword: 'NewStrong!5678' }) })).status, 200)
})

test('login returns signed claims and protected routes enforce authentication and role access', async () => {
  const { service, request } = await createTestApi()
  const registrationResponse = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  assert.equal(registrationResponse.status, 201)
  const blockedBeforeOtp = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', password: strongPassword }) })
  assert.equal(blockedBeforeOtp.status, 401)
  const otp = registrationResponse.data.developmentOnlyOtp
  assert.match(otp, /^\d{6}$/)
  assert.notEqual(service.repository.users[0].verificationCodeHash, otp)
  const verified = await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', code: otp }) })
  assert.equal(verified.status, 200)
  const reusedOtp = await request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', code: otp }) })
  assert.equal(reusedOtp.status, 400)
  const login = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', password: strongPassword }) })
  assert.equal(login.status, 200)
  assert.equal(login.data.user.role, 'citizen')
  assert.equal('passwordHash' in login.data.user, false)
  const context = await service.authenticate(login.data.accessToken)
  assert.equal(context.userId, registrationResponse.data.user.id)
  assert.equal(context.role, 'citizen')

  const badLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', password: 'wrong' }) })
  assert.equal(badLogin.status, 401)
  const unknownEmail = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'unknown@example.test', password: strongPassword }) })
  assert.equal(unknownEmail.status, 401)
  const missingAuth = await request('/test/citizen')
  assert.equal(missingAuth.status, 401)
  const citizenOnAdmin = await request('/test/admin', { headers: { Authorization: `Bearer ${login.data.accessToken}` } })
  assert.equal(citizenOnAdmin.status, 403)
  const citizenAllowed = await request('/test/citizen', { headers: { Authorization: `Bearer ${login.data.accessToken}` } })
  assert.equal(citizenAllowed.status, 200)
  const invalidToken = await request('/api/auth/me', { headers: { Authorization: 'Bearer invalid.jwt.token' } })
  assert.equal(invalidToken.status, 401)
  const me = await request('/api/auth/me', { headers: { Authorization: `Bearer ${login.data.accessToken}` } })
  assert.equal(me.status, 200)
  assert.equal(me.data.user.email, 'citizen@example.test')

  const logout = await request('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${login.data.accessToken}` } })
  assert.equal(logout.status, 200)
  const revoked = await request('/api/auth/me', { headers: { Authorization: `Bearer ${login.data.accessToken}` } })
  assert.equal(revoked.status, 401)
})

test('forgot/reset uses one-time expiring hashed tokens without email enumeration', async () => {
  const { service, request, mailer } = await createTestApi()
  await service.register(registration({}))
  const existing = await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test' }) })
  const missing = await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'absent@example.test' }) })
  assert.equal(existing.status, 202)
  assert.equal(existing.body.message, missing.body.message)
  assert.equal('debugResetToken' in existing.body, false)

  const resetToken = mailer.sentResets[0].token
  assert.ok(resetToken)
  const storedHash = service.repository.users[0].passwordResetTokenHash
  assert.notEqual(storedHash, resetToken)
  const reset = await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password: 'NewStrong!5678', confirmPassword: 'NewStrong!5678' }) })
  assert.equal(reset.status, 200)
  assert.equal(service.repository.users[0].passwordResetTokenHash, undefined)
  assert.equal(await bcrypt.compare('NewStrong!5678', service.repository.users[0].passwordHash), true)
  const reused = await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password: 'AnotherStrong!6789', confirmPassword: 'AnotherStrong!6789' }) })
  assert.equal(reused.status, 400)
  service.repository.users[0].passwordResetIssuedAt = new Date(Date.now() - 61_000)
  const expiredToken = await service.forgotPassword('citizen@example.test')
  service.repository.users[0].passwordResetExpiresAt = new Date(Date.now() - 1000)
  const expired = await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: expiredToken, password: 'AnotherStrong!6789', confirmPassword: 'AnotherStrong!6789' }) })
  assert.equal(expired.status, 400)
})

test('authenticated password changes validate the current password and revoke all prior sessions', async () => {
  const { service, request } = await createTestApi()
  const registrationResult = await service.register(registration({}))
  await service.verifyEmail('citizen@example.test', registrationResult.developmentOnlyOtp)
  const login = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', password: strongPassword }) })
  const headers = { Authorization: `Bearer ${login.data.accessToken}` }
  const denied = await request('/api/auth/change-password', { method: 'PATCH', headers, body: JSON.stringify({ currentPassword: 'WrongCurrent!123', newPassword: 'ChangedStrong!123', confirmPassword: 'ChangedStrong!123' }) })
  assert.equal(denied.status, 400)
  const changed = await request('/api/auth/change-password', { method: 'PATCH', headers, body: JSON.stringify({ currentPassword: strongPassword, newPassword: 'ChangedStrong!123', confirmPassword: 'ChangedStrong!123' }) })
  assert.equal(changed.status, 200)
  const oldSession = await request('/api/auth/me', { headers })
  assert.equal(oldSession.status, 401)
  const newLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', password: 'ChangedStrong!123' }) })
  assert.equal(newLogin.status, 200)
  const reused = await request('/api/auth/change-password', { method: 'PATCH', headers: { Authorization: `Bearer ${newLogin.data.accessToken}` }, body: JSON.stringify({ currentPassword: 'ChangedStrong!123', newPassword: 'ChangedStrong!123', confirmPassword: 'ChangedStrong!123' }) })
  assert.equal(reused.status, 400)
})

test('admin provisioning is server-side, hashes the password, and never has a public registration path', async () => {
  const { service, request } = await createTestApi()
  const admin = await service.provisionAdmin({ fullName: 'Demo Administrator', email: 'admin@example.test', phone: '+919000000003', password: strongPassword })
  assert.equal(admin.role, 'admin')
  assert.equal(await bcrypt.compare(strongPassword, service.repository.users[0].passwordHash), true)
  const login = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: admin.email, password: strongPassword }) })
  const adminRoute = await request('/test/admin', { headers: { Authorization: `Bearer ${login.data.accessToken}` } })
  assert.equal(adminRoute.status, 200)
  const unchanged = await service.provisionAdmin({ fullName: 'Changed Name', email: admin.email, phone: '+919000000004', password: 'DifferentPass!5678' })
  assert.equal(unchanged.id, admin.id)
  assert.equal(service.repository.users.length, 1)
  assert.equal(await bcrypt.compare(strongPassword, service.repository.users[0].passwordHash), true)
  const noAdminSignup = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...registration({ email: 'attacker@example.test' }), role: 'admin' }) })
  assert.equal(noAdminSignup.status, 400)
})

test('citizen provisioning hashes with registration settings, verifies the account, and never overwrites duplicates', async () => {
  const { service } = await createTestApi()
  const input = registration({})
  const created = await service.provisionCitizen(input)
  assert.deepEqual(created, { created: true })
  const saved = service.repository.users[0]
  assert.equal(saved.role, 'citizen')
  assert.equal(saved.emailVerified, true)
  assert.equal(saved.email, input.email)
  assert.equal(saved.phoneNumber, '+919000000001')
  assert.equal(await bcrypt.compare(strongPassword, saved.passwordHash), true)

  const duplicateEmail = await service.provisionCitizen(registration({ fullName: 'Changed Name', phone: '+919000000002', password: 'DifferentPass!5678' }))
  assert.deepEqual(duplicateEmail, { created: false })
  assert.equal(service.repository.users.length, 1)
  assert.equal(saved.fullName, 'Test Citizen')
  assert.equal(saved.phoneNumber, '+919000000001')
  assert.equal(await bcrypt.compare(strongPassword, saved.passwordHash), true)

  await service.provisionAdmin({ fullName: 'Admin', email: 'admin@example.test', phone: '+919000000003', password: strongPassword })
  const duplicatePhone = await service.provisionCitizen(registration({ email: 'another@example.test', phone: '+919000000003' }))
  assert.deepEqual(duplicatePhone, { created: false })
  assert.equal(service.repository.users.length, 2)
})

test('authentication endpoints enforce the configured per-IP rate limit', async () => {
  const repository = new MemoryAuthRepository()
  const service = new AuthService({ repository, secret: 'test-only-secret-with-more-than-32-bytes', accessTokenTtlSeconds: 600, resetTokenTtlMinutes: 15 })
  const app = express()
  app.use(express.json())
  app.use('/api/auth', createAuthRouter(service))
  app.use(errorHandler)
  const server = createServer(app)
  servers.add(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const url = `http://127.0.0.1:${address.port}/api/auth/login`
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await fetch(`http://127.0.0.1:${address.port}/api/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `absent-${attempt}@example.test` }) })
  }
  let response
  for (let attempt = 0; attempt < 11; attempt += 1) {
    response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  }
  assert.equal(response.status, 429)
})

function registration(overrides = {}) {
  return { fullName: 'Test Citizen', email: 'citizen@example.test', phone: '+91 90000 00001', password: strongPassword, confirmPassword: strongPassword, ...overrides }
}

async function createTestApi(options = {}) {
  const repository = new MemoryAuthRepository()
  const mailer = options.otpProvider ?? new RecordingOtpProvider()
  const service = new AuthService({ repository, secret: 'test-only-secret-with-more-than-32-bytes', accessTokenTtlSeconds: 600, resetTokenTtlMinutes: 15, otpTtlMinutes: options.otpTtlMinutes ?? 5, otpMaxAttempts: options.otpMaxAttempts ?? 5, otpResendCooldownSeconds: options.otpResendCooldownSeconds ?? 60, runtimeEnvironment: options.runtimeEnvironment ?? 'development', exposeDevelopmentOtp: options.exposeDevelopmentOtp ?? true, otpProvider: mailer })
  const app = express()
  app.use(express.json())
  const noLimit = (_request, _response, next) => next()
  app.use('/api/auth', createAuthRouter(service, noLimit, noLimit))
  const authenticate = createAuthenticationMiddleware(service)
  app.get('/test/citizen', authenticate, requireCitizen, (_request, response) => response.json({ status: 'success' }))
  app.get('/test/admin', authenticate, requireAdmin, (_request, response) => response.json({ status: 'success' }))
  app.use(errorHandler)
  const server = createServer(app)
  servers.add(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const base = `http://127.0.0.1:${address.port}`
  const request = async (path, init = {}) => {
    const response = await fetch(`${base}${path}`, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } })
    const body = await response.json()
    return { status: response.status, body, data: body.data }
  }
  return { service, request, mailer }
}

class MemoryAuthRepository {
  users = []
  revoked = new Set()
  nextId = 1

  async findByEmailOrPhone(email, phone) {
    return this.users.some((user) => user.email === email || user.phoneNumber === phone)
  }

  async createUser(input) {
    const user = { id: this.nextId.toString(16).padStart(24, '0'), ...input, accountStatus: 'active', emailVerified: input.emailVerified ?? false, createdAt: new Date() }
    this.nextId += 1
    this.users.push(user)
    return { ...user }
  }

  async findForLogin(email) { return this.users.find((user) => user.email === email) ?? null }
  async findForPasswordChange(id) { return this.users.find((user) => user.id === id) ?? null }
  async setPassword(id, passwordHash, changedAt) { const user = this.users.find((item) => item.id === id); if (!user) return false; user.passwordHash = passwordHash; user.passwordChangedAt = changedAt; return true }
  async findById(id) { return this.users.find((user) => user.id === id) ?? null }
  async findByEmail(email) { return this.users.find((user) => user.email === email) ?? null }

  async saveVerificationCode(email, hash, expiresAt, issuedAt, cooldownBefore) {
    const user = await this.findByEmail(email)
    if (!user || user.emailVerified) return false
    if (user.verificationCodeIssuedAt && user.verificationCodeIssuedAt > cooldownBefore) return false
    user.verificationCodeHash = hash
    user.verificationCodeExpiresAt = expiresAt
    user.verificationCodeIssuedAt = issuedAt
    user.verificationCodeAttempts = 0
    return true
  }

  async incrementVerificationAttempts(email, now, maxAttempts) {
    const user = this.users.find((item) => item.email === email && !item.emailVerified && item.verificationCodeHash && item.verificationCodeExpiresAt > now && item.verificationCodeAttempts < maxAttempts)
    if (!user) return false
    user.verificationCodeAttempts += 1
    return true
  }

  async consumeVerificationCode(email, hash, now, maxAttempts) {
    const user = this.users.find((item) => item.email === email && !item.emailVerified && item.verificationCodeHash === hash && item.verificationCodeExpiresAt > now && item.verificationCodeAttempts < maxAttempts)
    if (!user) return null
    user.emailVerified = true
    delete user.verificationCodeHash
    delete user.verificationCodeExpiresAt
    delete user.verificationCodeIssuedAt
    delete user.verificationCodeAttempts
    return user
  }

  async invalidateVerificationCode(email) {
    const user = await this.findByEmail(email)
    if (user) { delete user.verificationCodeHash; delete user.verificationCodeExpiresAt; delete user.verificationCodeAttempts }
  }

  async saveResetToken(email, hash, expiresAt, issuedAt, cooldownBefore) {
    const user = await this.findByEmail(email)
    if (!user || (user.passwordResetIssuedAt && user.passwordResetIssuedAt > cooldownBefore)) return false
    user.passwordResetTokenHash = hash
    user.passwordResetExpiresAt = expiresAt
    user.passwordResetIssuedAt = issuedAt
    return true
  }

  async invalidateResetToken(email) {
    const user = await this.findByEmail(email)
    if (user) { delete user.passwordResetTokenHash; delete user.passwordResetExpiresAt }
  }

  async consumeResetToken(hash, passwordHash, changedAt) {
    const user = this.users.find((item) => item.passwordResetTokenHash === hash && item.passwordResetExpiresAt > changedAt)
    if (!user) return false
    user.passwordHash = passwordHash
    user.passwordChangedAt = changedAt
    delete user.passwordResetTokenHash
    delete user.passwordResetExpiresAt
    return true
  }

  async revokeToken(tokenId) { this.revoked.add(tokenId) }
  async isTokenRevoked(tokenId) { return this.revoked.has(tokenId) }
}

class RecordingOtpProvider {
  sentCodes = []
  sentResets = []
  fail = false

  async sendCode(email, code, purpose, expiresAt, ttlMinutes) {
    if (this.fail) throw new Error('provider failed with secret details')
    this.sentCodes.push({ email, code, purpose, expiresAt, ttlMinutes })
  }

  async sendPasswordReset(email, token, expiresAt, ttlMinutes) {
    if (this.fail) throw new Error('provider failed with secret details')
    this.sentResets.push({ email, token, expiresAt, ttlMinutes })
  }
}
