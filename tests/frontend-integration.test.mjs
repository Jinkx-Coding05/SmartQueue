import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}

globalThis.localStorage = createMemoryStorage()
globalThis.sessionStorage = createMemoryStorage()

let vite
let modules

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  const [bookingData, queueData, adminData, appointmentService, dashboardData, counterService, authSession, http, aiInsightsPage] = await Promise.all([
    vite.ssrLoadModule('/src/services/mock/bookingData.ts'),
    vite.ssrLoadModule('/src/services/mock/queueData.ts'),
    vite.ssrLoadModule('/src/services/mock/adminData.ts'),
    vite.ssrLoadModule('/src/services/mock/appointmentService.ts'),
    vite.ssrLoadModule('/src/services/mock/citizenDashboardData.ts'),
    vite.ssrLoadModule('/src/services/mock/counterService.ts'),
    vite.ssrLoadModule('/src/services/authSession.ts'),
    vite.ssrLoadModule('/src/services/api/http.ts'),
    vite.ssrLoadModule('/src/pages/AdminAiInsightsPage.tsx'),
  ])
  modules = { bookingData, queueData, adminData, appointmentService, dashboardData, counterService, authSession, http, aiInsightsPage }
})

after(async () => { await vite?.close() })

test('new booking data flows through admin queue, citizen tracking, appointments and dashboard', () => {
  const { bookingData, queueData, adminData, appointmentService, dashboardData, counterService } = modules
  const booking = {
    token: 'SQ-AUDIT-700',
    center: bookingData.serviceCenters[0],
    department: 'Cardiology',
    visitType: 'New Consultation',
    date: '2099-05-17',
    time: '10:00 AM',
    estimatedWait: 18,
    peopleAhead: 5,
    currentServing: 'A-019',
    counter: 'Counter 02',
    stage: 'waiting',
    createdAt: '2099-05-17T08:00:00.000Z',
  }

  queueData.saveQueueBooking(booking)
  assert.equal(adminData.getAdminQueue().find((token) => token.id === booking.token)?.status, 'Waiting')
  assert.equal(dashboardData.getCitizenDashboardSnapshot().activeToken, booking.token)

  const departmentQueue = adminData.getAdminQueue().filter((token) => token.id === booking.token)
  const wrongDepartmentCounter = { id: 'Audit Pediatrics', name: 'Audit Pediatrics Desk', department: 'Pediatrics', staffMember: 'Demo staff', currentToken: '-', status: 'Available', lastUpdated: 'Just now' }
  const matchingDepartmentCounter = { ...wrongDepartmentCounter, id: 'Audit Cardiology', name: 'Audit Cardiology Desk', department: 'Cardiology' }
  assert.equal(adminData.getNextAssignableQueueItem(departmentQueue, [wrongDepartmentCounter]), null)
  assert.equal(adminData.getNextAssignableQueueItem(departmentQueue, [matchingDepartmentCounter])?.counter.id, matchingDepartmentCounter.id)
  adminData.saveAdminCounters([wrongDepartmentCounter, matchingDepartmentCounter])
  assert.equal(counterService.assignWaitingToken(booking.token, wrongDepartmentCounter.id).ok, false)
  assert.equal(counterService.assignWaitingToken(booking.token, matchingDepartmentCounter.id).ok, true)

  const queue = adminData.getAdminQueue().map((token) => token.id === booking.token ? { ...token, status: 'Serving', counter: matchingDepartmentCounter.id, waitingMinutes: 0 } : token)
  adminData.saveAdminQueue(queue)
  assert.equal(queueData.getQueueBooking(booking.token)?.stage, 'your-turn')
  assert.equal(queueData.getQueueBooking(booking.token)?.counter, matchingDepartmentCounter.id)
  assert.equal(appointmentService.getAppointments().find((appointment) => appointment.token === booking.token)?.status, 'upcoming')

  adminData.saveAdminQueue(queue.map((token) => token.id === booking.token ? { ...token, status: 'Cancelled' } : token))
  assert.equal(queueData.getQueueBooking(booking.token)?.stage, 'cancelled')
  assert.equal(appointmentService.getAppointments().find((appointment) => appointment.token === booking.token)?.status, 'cancelled')
  assert.notEqual(dashboardData.getCitizenDashboardSnapshot().activeToken, booking.token)
})

test('booking minimum date uses the local calendar day', () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const expected = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  assert.equal(modules.bookingData.getNextAvailableDate(1), expected)
})

test('API client restores stored bearer token, clears unauthorized sessions, and reports unavailable API', async () => {
  const { authSession, http } = modules
  globalThis.window = new EventTarget()
  const user = { id: 'citizen-1', fullName: 'Test Citizen', email: 'citizen@example.test', phoneNumber: '+919000000001', role: 'citizen', accountStatus: 'active', createdAt: new Date().toISOString() }
  authSession.setSession({ user, accessToken: 'test-jwt' }, false)
  const originalFetch = globalThis.fetch
  let authorization
  globalThis.fetch = async (_url, options) => { authorization = options.headers.get('Authorization'); return new Response(JSON.stringify({ status: 'success', data: { ok: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }) }
  assert.deepEqual(await http.apiRequest('/citizen/profile'), { ok: true })
  assert.equal(authorization, 'Bearer test-jwt')
  let unauthorized = false
  window.addEventListener('smartqueue:unauthorized', () => { unauthorized = true })
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 'error', message: 'Expired' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(http.apiRequest('/citizen/profile'), /Expired/)
  assert.equal(unauthorized, true)
  assert.equal(authSession.getAccessToken(), undefined)
  globalThis.fetch = async () => { throw new Error('offline') }
  await assert.rejects(http.apiRequest('/citizen/profile'), (error) => error.status === 0)
  globalThis.fetch = originalFetch
})

test('admin AI insights render Gemini, rule-based fallback, forecast confidence, and evidence states', () => {
  const { aiInsightsPage } = modules
  const gemini = renderToStaticMarkup(React.createElement(aiInsightsPage.InsightSourceBadge, { analysis: { provider: 'gemini', model: 'gemini-3.8-flash', timestamp: '2026-11-22T10:00:00.000Z' } }))
  assert.match(gemini, /Gemini analysis/)
  assert.match(gemini, /gemini-3.8-flash/)
  const fallback = renderToStaticMarkup(React.createElement(aiInsightsPage.InsightSourceBadge, { analysis: { provider: 'rule-based', model: null, timestamp: '2026-11-22T10:00:00.000Z', fallbackReason: 'missing-api-key' } }))
  assert.match(fallback, /Rule-based fallback/)
  const insufficient = renderToStaticMarkup(React.createElement(aiInsightsPage.PeakPeriodSummary, { forecast: { status: 'insufficient-historical-data', minimumObservedDays: 28, observedDays: 4, historicalTokenCount: 9, expectedByWeekday: [], method: 'historical averages' } }))
  assert.match(insufficient, /Insufficient historical data/)
  const available = renderToStaticMarkup(React.createElement(aiInsightsPage.PeakPeriodSummary, { forecast: { status: 'available', minimumObservedDays: 28, observedDays: 35, historicalTokenCount: 140, expectedByWeekday: [{ weekday: 1, averageTokens: 5, observedDays: 5 }], method: 'historical averages' } }))
  assert.match(available, /Monday/)
  assert.match(available, /5 tokens/)
  const recommendation = renderToStaticMarkup(React.createElement(aiInsightsPage.RecommendationCard, { item: { type: 'operations', severity: 'medium', title: 'Review counter coverage', reason: 'Waiting activity is above service capacity.', suggestedAction: 'Review additional staffed coverage.', supportingDatabaseMetrics: [{ key: 'waitingTokens', value: 18 }], confidence: 'medium', source: 'gemini' } }))
  assert.match(recommendation, /Review counter coverage/)
  assert.match(recommendation, /Suggested action/)
  assert.match(recommendation, /18/)
  assert.match(recommendation, /medium confidence/)
})
