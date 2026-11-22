import assert from 'node:assert/strict'
import express from 'express'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import { createCitizenRouter, createDepartmentRouter } from '../server/src/routes/citizenRoutes.ts'
import { errorHandler } from '../server/src/middleware/errorHandler.ts'
import { CitizenService } from '../server/src/services/citizenService.ts'

const servers = new Set()
const citizenId = '000000000000000000000001'
const otherCitizenId = '000000000000000000000002'
const departmentId = '000000000000000000000101'
const inactiveDepartmentId = '000000000000000000000102'

after(async () => Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve)))))

test('citizen profile APIs return safe fields, update permitted values, and reject mass assignment', async () => {
  const { request } = await createTestApi()
  const unauthorized = await request('/api/citizen/profile')
  assert.equal(unauthorized.status, 401)
  const profile = await request('/api/citizen/profile', { headers: auth(citizenId) })
  assert.equal(profile.status, 200)
  assert.equal('passwordHash' in profile.data.profile, false)
  const updated = await request('/api/citizen/profile', { method: 'PATCH', headers: auth(citizenId), body: JSON.stringify({ fullName: 'Riya Sharma', gender: 'Female', address: { city: 'Bengaluru', pinCode: '560001' } }) })
  assert.equal(updated.status, 200)
  assert.equal(updated.data.profile.fullName, 'Riya Sharma')
  assert.equal(updated.data.profile.address.city, 'Bengaluru')
  const massAssignment = await request('/api/citizen/profile', { method: 'PATCH', headers: auth(citizenId), body: JSON.stringify({ role: 'admin', accountStatus: 'suspended' }) })
  assert.equal(massAssignment.status, 400)
  const invalidDate = await request('/api/citizen/profile', { method: 'PATCH', headers: auth(citizenId), body: JSON.stringify({ dateOfBirth: '2035-14-40' }) })
  assert.equal(invalidDate.status, 400)
})

test('department listing filters inactive departments and validates IDs', async () => {
  const { request } = await createTestApi()
  const listed = await request('/api/departments')
  assert.equal(listed.status, 200)
  assert.equal(listed.data.departments.length, 1)
  assert.equal(listed.data.departments[0].available, true)
  assert.equal((await request(`/api/departments/${inactiveDepartmentId}`)).status, 404)
  assert.equal((await request('/api/departments/not-an-id')).status, 400)
})

test('token booking prevents duplicates, calculates queue position, enforces ownership, and cancels only waiting tokens', async () => {
  const { repository, request } = await createTestApi()
  const before = new Date(Date.now() - 60_000)
  repository.seedToken({ tokenNumber: 'SQ-AHEAD', citizen: otherCitizenId, departmentId, status: 'waiting', bookingDate: before, estimatedWaitingTime: 10 })
  repository.seedToken({ tokenNumber: 'SQ-SERVING', citizen: '000000000000000000000003', departmentId, status: 'serving', bookingDate: before, estimatedWaitingTime: 4 })
  const preferences = { preferredVisitDate: futureDate(2), preferredTime: '10:30', visitType: 'Follow-up' }
  assert.equal((await request('/api/tokens', { method: 'POST', headers: auth(citizenId), body: JSON.stringify({ departmentId, preferredVisitDate: preferences.preferredVisitDate }) })).status, 400)
  const booked = await request('/api/tokens', { method: 'POST', headers: auth(citizenId), body: JSON.stringify({ departmentId, ...preferences }) })
  assert.equal(booked.status, 201)
  const tokenId = booked.data.token.id
  assert.match(booked.data.token.tokenNumber, /^SQ-\d{8}-[A-F0-9]{6}$/)
  assert.equal(booked.data.token.status, 'waiting')
  assert.equal(booked.data.token.preferredVisitDate, preferences.preferredVisitDate)
  assert.equal(booked.data.token.preferredTime, preferences.preferredTime)
  assert.equal(booked.data.token.visitType, preferences.visitType)
  const duplicate = await request('/api/tokens', { method: 'POST', headers: auth(citizenId), body: JSON.stringify({ departmentId }) })
  assert.equal(duplicate.status, 409)
  const tracking = await request(`/api/tokens/${tokenId}/tracking`, { headers: auth(citizenId) })
  assert.equal(tracking.status, 200)
  assert.equal(tracking.data.tracking.queuePosition, 2)
  assert.equal(tracking.data.tracking.estimatedWaitingTime, 7)
  assert.equal(tracking.data.tracking.currentlyServingToken, 'SQ-SERVING')
  assert.equal(tracking.data.tracking.preferredVisitDate, preferences.preferredVisitDate)
  assert.equal((await request('/api/tokens/my?page=1&limit=10', { headers: auth(citizenId) })).data.items.length, 1)
  assert.equal((await request(`/api/tokens/${tokenId}`, { headers: auth(citizenId) })).status, 200)
  assert.equal((await request(`/api/tokens/${tokenId}`, { headers: auth(otherCitizenId) })).status, 404)
  assert.equal((await request(`/api/tokens/${tokenId}/cancel`, { method: 'POST', headers: auth(otherCitizenId) })).status, 404)
  assert.equal((await request(`/api/tokens/${tokenId}/cancel`, { method: 'POST', headers: auth(citizenId) })).status, 200)
  assert.equal((await request(`/api/tokens/${tokenId}/cancel`, { method: 'POST', headers: auth(citizenId) })).status, 409)
  const completed = repository.seedToken({ tokenNumber: 'SQ-DONE', citizen: citizenId, departmentId, status: 'completed', bookingDate: new Date(), estimatedWaitingTime: 0 })
  assert.equal((await request(`/api/tokens/${completed.id}/cancel`, { method: 'POST', headers: auth(citizenId) })).status, 409)
  assert.equal((await request('/api/tokens/not-an-id', { headers: auth(citizenId) })).status, 400)
})

test('appointments validate future times, prevent duplicates, enforce ownership, and permit rescheduling', async () => {
  const { request } = await createTestApi()
  const appointmentDate = futureDate(2)
  const body = { departmentId, appointmentDate, appointmentTime: '10:30', notes: 'Bring previous reports.' }
  const created = await request('/api/appointments', { method: 'POST', headers: auth(citizenId), body: JSON.stringify(body) })
  assert.equal(created.status, 201)
  assert.equal(created.data.appointment.status, 'pending')
  assert.equal((await request('/api/appointments/my?page=1', { headers: auth(citizenId) })).data.items.length, 1)
  assert.equal((await request('/api/appointments', { method: 'POST', headers: auth(citizenId), body: JSON.stringify(body) })).status, 409)
  assert.equal((await request('/api/appointments', { method: 'POST', headers: auth(citizenId), body: JSON.stringify({ ...body, status: 'completed' }) })).status, 400)
  assert.equal((await request(`/api/appointments/${created.data.appointment.id}`, { headers: auth(otherCitizenId) })).status, 404)
  const rescheduled = await request(`/api/appointments/${created.data.appointment.id}`, { method: 'PATCH', headers: auth(citizenId), body: JSON.stringify({ appointmentDate: futureDate(3), appointmentTime: '11:00' }) })
  assert.equal(rescheduled.status, 200)
  assert.equal(rescheduled.data.appointment.status, 'rescheduled')
  assert.equal((await request('/api/appointments', { method: 'POST', headers: auth(citizenId), body: JSON.stringify({ ...body, appointmentDate: '2000-01-01' }) })).status, 400)
  assert.equal((await request(`/api/appointments/${created.data.appointment.id}/cancel`, { method: 'POST', headers: auth(citizenId) })).status, 200)
  assert.equal((await request(`/api/appointments/${created.data.appointment.id}`, { method: 'PATCH', headers: auth(citizenId), body: JSON.stringify({ notes: 'Too late' }) })).status, 409)
})

test('document metadata is owner-scoped and clearly remains metadata-only without file storage', async () => {
  const { request } = await createTestApi()
  const created = await request('/api/documents', {
    method: 'POST', headers: auth(citizenId),
    body: JSON.stringify({ documentType: 'Government ID', fileMetadata: { originalName: 'identity.pdf', mimeType: 'application/pdf', sizeBytes: 1024 } }),
  })
  assert.equal(created.status, 201)
  assert.equal(created.data.document.storageStatus, 'metadata-only')
  assert.match(created.data.document.storageMessage, /not configured/)
  assert.equal((await request('/api/documents/my?page=1', { headers: auth(citizenId) })).data.items.length, 1)
  assert.equal((await request(`/api/documents/${created.data.document.id}`, { method: 'DELETE', headers: auth(otherCitizenId) })).status, 404)
  assert.equal((await request(`/api/documents/${created.data.document.id}`, { method: 'DELETE', headers: auth(citizenId) })).status, 204)
  const invalidFile = await request('/api/documents', { method: 'POST', headers: auth(citizenId), body: JSON.stringify({ documentType: 'ID', fileMetadata: { originalName: 'virus.exe', mimeType: 'application/octet-stream', sizeBytes: 10 } }) })
  assert.equal(invalidFile.status, 400)
})

test('notification reads and pagination remain scoped to the authenticated citizen', async () => {
  const { repository, request } = await createTestApi()
  const own = repository.seedNotification(citizenId, 'Your token is ready')
  const other = repository.seedNotification(otherCitizenId, 'Private notice')
  const listed = await request('/api/notifications/my?page=1&limit=1&unreadOnly=true', { headers: auth(citizenId) })
  assert.equal(listed.status, 200)
  assert.equal(listed.data.items.length, 1)
  assert.equal(listed.data.pagination.total, 1)
  assert.equal((await request(`/api/notifications/${other.id}/read`, { method: 'PATCH', headers: auth(citizenId) })).status, 404)
  assert.equal((await request(`/api/notifications/${own.id}/read`, { method: 'PATCH', headers: auth(citizenId) })).data.notification.isRead, true)
  assert.equal((await request('/api/notifications/read-all', { method: 'PATCH', headers: auth(citizenId) })).data.modifiedCount, 0)
})

function auth(id) { return { Authorization: `Bearer ${id}` } }
function futureDate(offset) { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }

async function createTestApi() {
  const repository = new MemoryCitizenRepository()
  const service = new CitizenService(repository)
  const app = express()
  app.use(express.json())
  app.use('/api/departments', createDepartmentRouter(service))
  app.use('/api', createCitizenRouter(service, (request, response, next) => {
    const id = request.header('authorization')?.replace(/^Bearer /, '')
    if (![citizenId, otherCitizenId].includes(id)) { response.status(401).json({ status: 'error', message: 'Authentication is required.' }); return }
    request.auth = { userId: id, role: 'citizen', tokenId: 'test-token', issuedAt: 1, expiresAt: 9999999999, user: { id, fullName: 'Demo Citizen', email: 'citizen@example.test', phoneNumber: '+919000000001', role: 'citizen', accountStatus: 'active', createdAt: new Date() } }
    next()
  }))
  app.use(errorHandler)
  const server = createServer(app)
  servers.add(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = async (path, init = {}) => {
    const response = await fetch(`${base}${path}`, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } })
    const body = response.status === 204 ? null : await response.json()
    return { status: response.status, body, data: body?.data }
  }
  return { repository, request }
}

class MemoryCitizenRepository {
  constructor() {
    this.nextId = 1000
    this.profiles = new Map([[citizenId, { id: citizenId, fullName: 'Demo Citizen', email: 'citizen@example.test', phoneNumber: '+919000000001', accountStatus: 'active', createdAt: new Date('2026-01-01T00:00:00Z'), address: {} }]])
    this.profiles.set(otherCitizenId, { id: otherCitizenId, fullName: 'Other Citizen', email: 'other@example.test', phoneNumber: '+919000000002', accountStatus: 'active', createdAt: new Date('2026-01-02T00:00:00Z'), address: {} })
    this.departments = [
      { id: departmentId, name: 'General Medicine', description: 'Primary care', workingHours: [], activeCounterCount: 2, available: true, isActive: true },
      { id: inactiveDepartmentId, name: 'Closed Department', description: '', workingHours: [], activeCounterCount: 0, available: false, isActive: false },
    ]
    this.tokens = []
    this.appointments = []
    this.documents = []
    this.notifications = []
  }

  id() { this.nextId += 1; return this.nextId.toString(16).padStart(24, '0') }
  async getProfile(userId) { return this.profiles.get(userId) ?? null }
  async updateProfile(userId, patch) {
    const profile = this.profiles.get(userId)
    if (!profile) return null
    const { address, ...fields } = patch
    Object.assign(profile, fields, { address: { ...profile.address, ...address } })
    if (patch.dateOfBirth) profile.dateOfBirth = new Date(`${patch.dateOfBirth}T00:00:00Z`)
    return profile
  }
  async listActiveDepartments() { return this.departments.filter((item) => item.isActive) }
  async getActiveDepartment(id) { return this.departments.find((item) => item.id === id && item.isActive) ?? null }
  async findActiveToken(userId, deptId, start, end) { return this.tokens.find((item) => item.citizen === userId && item.departmentId === deptId && ['waiting', 'serving'].includes(item.status) && item.bookingDate >= start && item.bookingDate < end) ?? null }
  async hasActivePreferenceKey(key) { return this.tokens.some((item) => item.activePreferenceKey === key && ['waiting', 'serving'].includes(item.status)) }
  async getQueueWaitEstimate(deptId, start, end) { const rows = this.tokens.filter((item) => item.departmentId === deptId && ['waiting', 'serving'].includes(item.status) && item.bookingDate >= start && item.bookingDate < end); return rows.length ? Math.ceil(rows.reduce((sum, row) => sum + row.estimatedWaitingTime, 0) / rows.length) : 0 }
  async createToken(input) {
    const dept = this.departments.find((item) => item.id === input.departmentId)
    const item = { id: this.id(), tokenNumber: input.tokenNumber, citizen: input.userId, departmentId: input.departmentId, departmentName: dept.name, status: 'waiting', bookingDate: input.bookingDate, estimatedWaitingTime: input.estimatedWaitingTime, preferredVisitDate: input.preferredVisitDate, preferredTime: input.preferredTime, visitType: input.visitType, activePreferenceKey: input.activePreferenceKey, createdAt: input.bookingDate, updatedAt: input.bookingDate }
    this.tokens.push(item); return item
  }
  seedToken({ tokenNumber, citizen, departmentId: deptId, status, bookingDate, estimatedWaitingTime }) {
    const item = { id: this.id(), tokenNumber, citizen, departmentId: deptId, departmentName: this.departments.find((d) => d.id === deptId).name, status, bookingDate, estimatedWaitingTime, createdAt: bookingDate, updatedAt: bookingDate }
    this.tokens.push(item); return item
  }
  async getOwnedToken(userId, id) { return this.tokens.find((item) => item.id === id && item.citizen === userId) ?? null }
  async listOwnedTokens(userId, skip, limit) { const items = this.tokens.filter((item) => item.citizen === userId).slice(skip, skip + limit); return { items, total: this.tokens.filter((item) => item.citizen === userId).length } }
  async countWaitingAhead(deptId, date, id) { return this.tokens.filter((item) => item.departmentId === deptId && item.status === 'waiting' && item.id !== id && item.bookingDate.toDateString() === date.toDateString() && (item.bookingDate < date || (item.bookingDate.getTime() === date.getTime() && item.id < id))).length }
  async getCurrentlyServing(deptId) { const item = this.tokens.find((token) => token.departmentId === deptId && token.status === 'serving'); return item ? { tokenNumber: item.tokenNumber, counterName: 'Counter 01' } : null }
  async cancelOwnedToken(userId, id) { const item = await this.getOwnedToken(userId, id); if (!item || item.status !== 'waiting') return null; item.status = 'cancelled'; item.updatedAt = new Date(); return item }
  async findDuplicateAppointment(userId, deptId, date, time, excludeId) { return this.appointments.some((item) => item.citizen === userId && item.departmentId === deptId && item.appointmentDate.getTime() === date.getTime() && item.appointmentTime === time && ['pending', 'approved', 'rescheduled'].includes(item.status) && item.id !== excludeId) }
  async createAppointment(input) {
    const item = { id: this.id(), ...input, citizen: input.userId, departmentName: this.departments.find((d) => d.id === input.departmentId).name, status: 'pending', createdAt: new Date(), updatedAt: new Date() }
    delete item.userId; this.appointments.push(item); return item
  }
  async getOwnedAppointment(userId, id) { return this.appointments.find((item) => item.id === id && item.citizen === userId) ?? null }
  async listOwnedAppointments(userId, skip, limit) { const rows = this.appointments.filter((item) => item.citizen === userId); return { items: rows.slice(skip, skip + limit), total: rows.length } }
  async updateOwnedAppointment(userId, id, fields) { const item = await this.getOwnedAppointment(userId, id); if (!item || !['pending', 'approved', 'rescheduled'].includes(item.status)) return null; Object.assign(item, fields, { updatedAt: new Date() }); return item }
  async cancelOwnedAppointment(userId, id) { const item = await this.getOwnedAppointment(userId, id); if (!item || !['pending', 'approved', 'rescheduled'].includes(item.status)) return null; item.status = 'cancelled'; return item }
  async createDocument(userId, input) { const item = { id: this.id(), ...input, verificationStatus: 'pending', storageStatus: 'metadata-only', uploadDate: new Date() }; this.documents.push({ ...item, citizen: userId }); return item }
  async listOwnedDocuments(userId, skip, limit) { const rows = this.documents.filter((item) => item.citizen === userId); return { items: rows.slice(skip, skip + limit), total: rows.length } }
  async deleteOwnedDocument(userId, id) { const index = this.documents.findIndex((item) => item.citizen === userId && item.id === id); if (index < 0) return false; this.documents.splice(index, 1); return true }
  async listNotifications(userId, skip, limit, unread) { const rows = this.notifications.filter((item) => item.user === userId && (!unread || !item.isRead)); return { items: rows.slice(skip, skip + limit), total: rows.length } }
  async markNotificationRead(userId, id) { const item = this.notifications.find((row) => row.id === id && row.user === userId); if (!item) return null; item.isRead = true; return item }
  async markAllNotificationsRead(userId) { let count = 0; this.notifications.forEach((item) => { if (item.user === userId && !item.isRead) { item.isRead = true; count += 1 } }); return count }
  seedNotification(user, message) { const item = { id: this.id(), user, title: 'Queue update', message, type: 'queue', isRead: false, createdAt: new Date() }; this.notifications.push(item); return item }
}
