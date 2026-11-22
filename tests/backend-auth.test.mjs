import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import express from 'express'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import { createAuthenticationMiddleware, requireAdmin, requireCitizen } from '../server/src/middleware/auth.ts'
import { errorHandler } from '../server/src/middleware/errorHandler.ts'
import { AuthService } from '../server/src/services/authService.ts'
import { createAuthRouter } from '../server/src/routes/authRoutes.ts'

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
  assert.equal(duplicateEmail.status, 409)
  const duplicatePhone = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...body, email: 'other@example.test' }) })
  assert.equal(duplicatePhone.status, 409)
  const invalid = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...body, password: 'weak', confirmPassword: 'weak', role: 'admin' }) })
  assert.equal(invalid.status, 400)
  assert.equal(service.repository.users.length, 1)
})

test('login returns signed claims and protected routes enforce authentication and role access', async () => {
  const { service, request } = await createTestApi()
  const registrationResponse = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration({})) })
  assert.equal(registrationResponse.status, 201)
  const blockedBeforeOtp = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test', password: strongPassword }) })
  assert.equal(blockedBeforeOtp.status, 401)
  const otp = await service.resendVerificationCode('citizen@example.test')
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
  const { service, request } = await createTestApi()
  await service.register(registration({}))
  const existing = await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'citizen@example.test' }) })
  const missing = await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'absent@example.test' }) })
  assert.equal(existing.status, 202)
  assert.equal(existing.body.message, missing.body.message)
  assert.equal('debugResetToken' in existing.body, false)

  const resetToken = await service.forgotPassword('citizen@example.test')
  assert.ok(resetToken)
  const storedHash = service.repository.users[0].passwordResetTokenHash
  assert.notEqual(storedHash, resetToken)
  const reset = await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password: 'NewStrong!5678', confirmPassword: 'NewStrong!5678' }) })
  assert.equal(reset.status, 200)
  assert.equal(service.repository.users[0].passwordResetTokenHash, undefined)
  assert.equal(await bcrypt.compare('NewStrong!5678', service.repository.users[0].passwordHash), true)
  const reused = await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password: 'AnotherStrong!6789', confirmPassword: 'AnotherStrong!6789' }) })
  assert.equal(reused.status, 400)
  const expiredToken = await service.forgotPassword('citizen@example.test')
  service.repository.users[0].passwordResetExpiresAt = new Date(Date.now() - 1000)
  const expired = await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: expiredToken, password: 'AnotherStrong!6789', confirmPassword: 'AnotherStrong!6789' }) })
  assert.equal(expired.status, 400)
})

test('authenticated password changes validate the current password and revoke all prior sessions', async () => {
  const { service, request } = await createTestApi()
  const registrationResult = await service.register(registration({}))
  await service.verifyEmail('citizen@example.test', registrationResult.debugVerificationCode)
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
  let response
  for (let attempt = 0; attempt < 11; attempt += 1) {
    response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  }
  assert.equal(response.status, 429)
})

function registration(overrides = {}) {
  return { fullName: 'Test Citizen', email: 'citizen@example.test', phone: '+91 90000 00001', password: strongPassword, confirmPassword: strongPassword, ...overrides }
}

async function createTestApi() {
  const repository = new MemoryAuthRepository()
  const service = new AuthService({ repository, secret: 'test-only-secret-with-more-than-32-bytes', accessTokenTtlSeconds: 600, resetTokenTtlMinutes: 15, exposeDevelopmentOtp: true })
  const app = express()
  app.use(express.json())
  app.use('/api/auth', createAuthRouter(service, (_request, _response, next) => next()))
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
  return { service, request }
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

  async saveVerificationCode(email, hash, expiresAt) {
    const user = await this.findByEmail(email)
    if (!user || user.emailVerified) return false
    user.verificationCodeHash = hash
    user.verificationCodeExpiresAt = expiresAt
    return true
  }

  async consumeVerificationCode(email, hash, now) {
    const user = this.users.find((item) => item.email === email && !item.emailVerified && item.verificationCodeHash === hash && item.verificationCodeExpiresAt > now)
    if (!user) return null
    user.emailVerified = true
    delete user.verificationCodeHash
    delete user.verificationCodeExpiresAt
    return user
  }

  async saveResetToken(email, hash, expiresAt) {
    const user = await this.findByEmail(email)
    if (!user) return false
    user.passwordResetTokenHash = hash
    user.passwordResetExpiresAt = expiresAt
    return true
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
