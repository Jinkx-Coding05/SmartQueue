import assert from 'node:assert/strict'
import express from 'express'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import { createAdminRouter } from '../server/src/routes/adminRoutes.ts'
import { errorHandler } from '../server/src/middleware/errorHandler.ts'
import { canTransitionToken, makeRecommendation } from '../server/src/services/adminService.ts'

const servers = new Set()
const adminId = '000000000000000000000001'

after(async () => Promise.all([...servers].map(server => new Promise(resolve => server.close(resolve)))))

test('all admin endpoints require authentication and admin role', async () => {
  const { request } = await api()
  assert.equal((await request('/api/admin/dashboard')).status, 401)
  assert.equal((await request('/api/admin/dashboard', 'citizen')).status, 403)
  const admin = await request('/api/admin/dashboard', 'admin')
  assert.equal(admin.status, 200)
  assert.equal(admin.data.metrics.source, 'db')
})

test('admin request schemas reject invalid status, IDs, pagination, and mass assignment', async () => {
  const { request } = await api()
  assert.equal((await request('/api/admin/tokens?page=0', 'admin')).status, 400)
  assert.equal((await request('/api/admin/queues/not-an-id', 'admin')).status, 400)
  assert.equal((await request('/api/admin/settings', 'admin', 'PATCH', { role: 'citizen' })).status, 400)
  assert.equal((await request('/api/admin/departments', 'admin', 'POST', { name: 'X' })).status, 400)
})

test('admin profile is self scoped and notification preferences are strictly validated', async () => {
  const { request } = await api()
  assert.equal((await request('/api/admin/profile', 'admin')).status, 200)
  assert.equal((await request('/api/admin/profile', 'admin', 'PATCH', { role: 'citizen' })).status, 400)
  assert.equal((await request('/api/admin/notification-preferences', 'admin')).status, 200)
  assert.equal((await request('/api/admin/notification-preferences', 'admin', 'PATCH', { newAppointments: true, cancellations: false, delays: true, dailySummary: false, role: 'citizen' })).status, 400)
  assert.equal((await request('/api/admin/notification-preferences', 'admin', 'PATCH', { newAppointments: true, cancellations: false, delays: true, dailySummary: false })).status, 200)
})

test('admin counter CRUD and status endpoints round-trip saved values', async () => {
  const counterId = '000000000000000000000201'
  const departmentId = '000000000000000000000202'
  let counter = null
  const service = new Proxy({
    createCounter: async (_actor, value) => (counter = { _id: counterId, ...value }),
    counter: async () => counter,
    updateCounter: async (_actor, _id, value) => (counter = { ...counter, ...value }),
    setCounterStatus: async (_actor, _id, status) => (counter = { ...counter, status }),
    deleteCounter: async () => { counter = null; return { deleted: true } },
  }, { get: (target, method) => target[method] ?? (async () => ({ items: counter ? [counter] : [] })) })
  const { request } = await api(service)
  const created = await request('/api/admin/counters', 'admin', 'POST', { name: 'Registration Desk', counterNumber: 'CTR-21', departmentId, status: 'available' })
  assert.equal(created.status, 201)
  assert.equal(created.data.counterNumber, 'CTR-21')
  assert.equal((await request(`/api/admin/counters/${counterId}`, 'admin')).data.status, 'available')
  assert.equal((await request(`/api/admin/counters/${counterId}`, 'admin', 'PATCH', { name: 'Main Registration Desk' })).data.name, 'Main Registration Desk')
  assert.equal((await request(`/api/admin/counters/${counterId}/status`, 'admin', 'PATCH', { status: 'maintenance' })).data.status, 'maintenance')
  assert.equal((await request('/api/admin/counters', 'admin')).data.items[0].status, 'maintenance')
  assert.equal((await request(`/api/admin/counters/${counterId}`, 'admin', 'DELETE')).status, 200)
  assert.equal((await request('/api/admin/counters', 'admin')).data.items.length, 0)
})

test('admin profile and notification preference updates persist and are returned on reload', async () => {
  let profile = { fullName: 'Admin', email: 'admin@example.test', phoneNumber: '+919000000001' }
  let preferences = { newAppointments: true, cancellations: true, delays: true, dailySummary: false }
  const service = new Proxy({
    getAdminProfile: async () => profile,
    updateAdminProfile: async (_actor, patch) => (profile = { ...profile, ...patch }),
    getAdminNotificationPreferences: async () => preferences,
    updateAdminNotificationPreferences: async (_actor, next) => (preferences = next),
  }, { get: (target, method) => target[method] ?? (async () => ({ items: [] })) })
  const { request } = await api(service)
  const updatedProfile = await request('/api/admin/profile', 'admin', 'PATCH', { fullName: 'Updated Admin', phoneNumber: '+919000000099' })
  assert.equal(updatedProfile.data.fullName, 'Updated Admin')
  assert.equal((await request('/api/admin/profile', 'admin')).data.phoneNumber, '+919000000099')
  const updatedPreferences = await request('/api/admin/notification-preferences', 'admin', 'PATCH', { newAppointments: false, cancellations: true, delays: false, dailySummary: true })
  assert.deepEqual(updatedPreferences.data, { newAppointments: false, cancellations: true, delays: false, dailySummary: true })
  assert.deepEqual((await request('/api/admin/notification-preferences', 'admin')).data, updatedPreferences.data)
})

test('token lifecycle permits only valid forward transitions', () => {
  assert.equal(canTransitionToken('waiting', 'serving'), true)
  assert.equal(canTransitionToken('serving', 'completed'), true)
  assert.equal(canTransitionToken('completed', 'waiting'), false)
  assert.equal(canTransitionToken('cancelled', 'serving'), false)
})

test('queue recommendations are evidence based and stay empty below thresholds', () => {
  assert.equal(makeRecommendation(3, 2, 10), null)
  const result = makeRecommendation(24, 2, 35)
  assert.equal(result.severity, 'high')
  assert.match(result.reason, /24 people are waiting/)
})

async function api(service = new Proxy({}, { get: (_target, method) => async () => ({ metrics: { source: 'db' }, action: String(method) }) })) {
  const authenticate = (req, res, next) => {
    const role = req.header('authorization')?.replace('Bearer ', '')
    if (!role) { res.status(401).json({ status: 'error', message: 'Authentication is required.' }); return }
    const user = { id: adminId, fullName: 'Admin' }
    req.auth = { userId: adminId, role, user, tokenId: 'test', issuedAt: 1, expiresAt: 9999999999 }
    next()
  }
  const app = express(); app.use(express.json()); app.use('/api/admin', createAdminRouter(service, authenticate)); app.use(errorHandler)
  const server = createServer(app); servers.add(server)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  return { request: async (path, role, method = 'GET', body) => { const response = await fetch(`${base}${path}`, { method, headers: { ...(role ? { Authorization: `Bearer ${role}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); const json = (response.headers.get('content-type') ?? '').includes('json') ? await response.json() : {}; return { status: response.status, data: json.data } } }
}
