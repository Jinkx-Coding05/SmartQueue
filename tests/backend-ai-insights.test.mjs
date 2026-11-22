import assert from 'node:assert/strict'
import express from 'express'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import { createAdminRouter } from '../server/src/routes/adminRoutes.ts'
import { errorHandler } from '../server/src/middleware/errorHandler.ts'
import { GeminiInsightsService } from '../server/src/services/aiInsightsService.ts'

const servers = new Set()
const departmentId = '000000000000000000000101'
const fixedNow = () => new Date('2026-11-22T10:00:00.000Z')

after(async () => Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve)))))

test('valid Gemini JSON adds grounded analysis while preserving rule-based response fields', async () => {
  let requestBody
  const service = makeService(async (_url, options) => {
    requestBody = JSON.parse(options.body)
    return providerResponse(generatedPayload())
  })
  const result = await service.getInsights(undefined, snapshot)
  assert.equal(result.analysis.provider, 'gemini')
  assert.equal(result.analysis.model, 'gemini-test-flash')
  assert.equal(result.dataSource, 'aggregated MongoDB token and counter data')
  assert.equal(result.peakHours[0].hour, 10)
  assert.equal(result.generatedAnalysis.summary, 'The queue is currently busy.')
  assert.equal(result.recommendations.at(-1).supportingDatabaseMetrics[0].value, 18)
  assert.equal(result.recommendations.at(-1).source, 'gemini')
  assert.match(requestBody.contents[0].parts[0].text, /untrusted data/)
  assert.match(requestBody.contents[0].parts[0].text, /"appointments":\{"total":15/)
  assert.match(requestBody.contents[0].parts[0].text, /historicalQueueTrend/)
  assert.equal(requestBody.generationConfig.responseMimeType, 'application/json')
  assert.equal(requestBody.generationConfig.responseJsonSchema.type, 'object')
  assert.equal('responseSchema' in requestBody.generationConfig, false)
  assert.equal(JSON.stringify(requestBody).includes('citizen@example.test'), false)
  assert.equal(JSON.stringify(requestBody).includes('+919000000001'), false)
  assert.equal(JSON.stringify(requestBody).includes('passwordHash'), false)
})

test('missing, malformed and invalid-key Gemini configuration falls back without fabricated output', async () => {
  let calls = 0
  const noKey = makeService(async () => { calls += 1; return providerResponse(generatedPayload()) }, '')
  const result = await noKey.getInsights(undefined, snapshot)
  assert.equal(result.analysis.provider, 'rule-based')
  assert.equal(result.analysis.fallbackReason, 'missing-api-key')
  assert.equal(result.generatedAnalysis, null)
  assert.equal(result.waitTimeAnalysis.departments[0].reliability, 'stored-estimate-fallback')
  assert.equal(calls, 0)

  const invalidKey = makeService(async () => { calls += 1; return providerResponse(generatedPayload()) }, 'too short')
  assert.equal((await invalidKey.getInsights(undefined, snapshot)).analysis.fallbackReason, 'invalid-api-key-config')
  const malformed = makeService(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{no json' }] } }] }) }))
  const malformedResult = await malformed.getInsights(undefined, snapshot)
  assert.equal(malformedResult.analysis.provider, 'rule-based')
  assert.equal(malformedResult.analysis.fallbackReason, 'malformed-response')
  assert.equal(malformedResult.generatedAnalysis, null)
})

test('Gemini numeric prose and unsupported evidence are rejected as malformed', async () => {
  const fabricated = { ...generatedPayload(), summary: 'There are 999 visitors.' }
  const invalid = makeService(async () => providerResponse(fabricated))
  const result = await invalid.getInsights(undefined, snapshot)
  assert.equal(result.analysis.fallbackReason, 'malformed-response')
  const unsupported = { ...generatedPayload(), recommendations: [{ ...generatedPayload().recommendations[0], evidenceKeys: ['averageServiceDurationMinutes'] }] }
  const invalidEvidence = makeService(async () => providerResponse(unsupported))
  assert.equal((await invalidEvidence.getInsights(undefined, snapshot)).analysis.fallbackReason, 'malformed-response')
})

test('Gemini timeout and provider failures preserve rule-based analytics', async () => {
  const timedOut = makeService((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
  }), 'AIza-test-key-that-is-long-enough', 5)
  const timeoutResult = await timedOut.getInsights(undefined, snapshot)
  assert.equal(timeoutResult.analysis.fallbackReason, 'timeout')
  assert.equal(timeoutResult.waiting.count, 18)

  let serverFailures = 0
  const failed = makeService(async () => { serverFailures += 1; return { ok: false, status: 503, json: async () => ({}) } })
  assert.equal((await failed.getInsights(undefined, snapshot)).analysis.fallbackReason, 'provider-error')
  assert.equal(serverFailures, 2)
  let quotaAttempts = 0
  const quota = makeService(async () => { quotaAttempts += 1; return { ok: false, status: 429, json: async () => ({}) } })
  assert.equal((await quota.getInsights(undefined, snapshot)).analysis.fallbackReason, 'quota-exceeded')
  assert.equal(quotaAttempts, 1)
  let authAttempts = 0
  const authFailure = makeService(async () => { authAttempts += 1; return { ok: false, status: 403, json: async () => ({}) } })
  assert.equal((await authFailure.getInsights(undefined, snapshot)).analysis.fallbackReason, 'configuration-error')
  assert.equal(authAttempts, 1)
  for (const [status, reason] of [[400, 'request-rejected'], [404, 'model-not-found']]) {
    let attempts = 0
    const rejected = makeService(async () => { attempts += 1; return { ok: false, status, json: async () => ({}) } })
    assert.equal((await rejected.getInsights(undefined, snapshot)).analysis.fallbackReason, reason)
    assert.equal(attempts, 1)
  }
  let networkAttempts = 0
  const networkFailure = makeService(async () => { networkAttempts += 1; throw new TypeError('fetch failed') })
  assert.equal((await networkFailure.getInsights(undefined, snapshot)).analysis.fallbackReason, 'network-error')
  assert.equal(networkAttempts, 2)
})

test('Gemini analysis is cached and insufficient history is explicit for predictions', async () => {
  let calls = 0
  let snapshotCalls = 0
  const service = makeService(async () => { calls += 1; return providerResponse(generatedPayload()) })
  const createSnapshot = async () => { snapshotCalls += 1; return { ...snapshot(), observedDays: 3, historicalTokenCount: 14 } }
  const first = await service.getInsights(undefined, createSnapshot)
  const second = await service.getInsights(undefined, createSnapshot)
  assert.equal(calls, 1)
  assert.equal(snapshotCalls, 1)
  assert.equal(second.analysis.timestamp, first.analysis.timestamp)
  assert.equal(first.peakPeriodAnalysis.forecast.status, 'insufficient-historical-data')
  assert.equal(first.peakPeriodAnalysis.forecast.expectedByWeekday.length, 0)
  assert.equal(first.waitTimeAnalysis.departments[0].estimatedWaitingTimeMinutes, 24)
  await service.getInsights(departmentId, createSnapshot)
  assert.equal(calls, 2)
})

test('completed service durations generate a bounded, timestamped reliability-labelled wait estimate', async () => {
  const service = makeService(async () => ({ ok: false, json: async () => ({}) }), '')
  const data = snapshot()
  data.departmentPerformance[0].completedServiceSamples = 40
  data.departmentPerformance[0].averageServiceDurationMinutes = 6
  const result = await service.getInsights(undefined, async () => data)
  const forecast = result.waitTimeAnalysis.departments[0]
  assert.equal(forecast.estimatedWaitingTimeMinutes, 57)
  assert.equal(forecast.reliability, 'historical-completed-service-duration')
  assert.equal(forecast.confidence, 'medium')
  assert.equal(result.waitTimeAnalysis.timestamp, '2026-11-22T10:00:00.000Z')
})

test('admin AI insight endpoints validate filters, preserve role checks, refresh, and rate limit', async () => {
  let calls = 0
  const service = new Proxy({
    insights: async (value) => { calls += 1; return { analysis: { provider: 'rule-based' }, departmentId: value ?? null } },
    refreshInsights: async (value) => { calls += 1; return { refreshed: true, departmentId: value ?? null } },
  }, { get: (target, key) => target[key] ?? (async () => ({})) })
  const { request } = await api(service)
  assert.equal((await request('/api/admin/ai-insights/overview?departmentId=bad', 'admin')).status, 400)
  assert.equal(calls, 0)
  assert.equal((await request('/api/admin/ai-insights/overview', 'citizen')).status, 403)
  assert.equal((await request('/api/admin/ai-insights/overview', 'admin')).status, 200)
  assert.equal((await request('/api/admin/ai-insights/refresh', 'admin', 'POST', { departmentId })).data.refreshed, true)
  for (let index = 0; index < 12; index += 1) await request('/api/admin/ai-insights/overview', 'admin')
  assert.equal((await request('/api/admin/ai-insights/overview', 'admin')).status, 429)
})

function makeService(fetcher, apiKey = 'AIza-test-key-that-is-long-enough', timeoutMs = 2000) {
  return new GeminiInsightsService({ apiKey, model: 'gemini-test-flash', timeoutMs, cacheTtlMs: 60_000 }, fetcher, fixedNow)
}

function providerResponse(value) {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }) }
}

function generatedPayload() {
  return {
    summary: 'The queue is currently busy.',
    historicalPattern: 'Recent activity is concentrated during the late morning.',
    departmentNotes: [{ departmentIndex: 0, note: 'The department has a steady recorded workload.' }],
    recommendations: [{ departmentIndex: 0, title: 'Review counter coverage', explanation: 'Waiting activity is above the available service capacity.', suggestedAction: 'Review whether an additional counter can be staffed.', priority: 'medium', evidenceKeys: ['waitingTokens', 'activeCounters'] }],
  }
}

function snapshot() {
  return {
    peakHours: [{ hour: 10, bookings: 12 }], waiting: { count: 18, averageEstimatedWaitMinutes: 24 },
    departmentPerformance: [{ department: { name: 'General Medicine' }, tokens: 80, avgWaitEstimate: 24, waitingTokens: 18, servingTokens: 1, activeCounters: 2, completedServiceSamples: 4, averageServiceDurationMinutes: null }],
    historicalTokenCount: 80, observedDays: 18, trafficByWeekday: [{ weekday: 1, bookings: 20, observedDays: 4 }],
    historicalQueueTrend: [{ date: '2026-11-21', tokens: 8, waiting: 3, completed: 4, cancelled: 1 }],
    appointments: { total: 15, completed: 10, cancelled: 2, completionRate: 66.7, cancellationRate: 13.3 },
    tokenOutcomes: { completed: 55, cancelled: 4, completionRate: 68.8, cancellationRate: 5 },
    activeCounterCount: 2,
    recommendations: [{ type: 'capacity', severity: 'high', title: 'Consider opening another counter', reason: '18 people are waiting across 2 counters.' }],
  }
}

async function api(service) {
  const authenticate = (req, res, next) => {
    const role = req.header('authorization')?.replace('Bearer ', '')
    if (!role) { res.status(401).json({ status: 'error' }); return }
    req.auth = { userId: '000000000000000000000001', role, user: { id: '000000000000000000000001', fullName: 'Admin' }, tokenId: 'test', issuedAt: 1, expiresAt: 9999999999 }
    next()
  }
  const app = express()
  app.use(express.json())
  app.use('/api/admin', createAdminRouter(service, authenticate))
  app.use(errorHandler)
  const server = createServer(app)
  servers.add(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  return { request: async (path, role, method = 'GET', body) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(role ? { Authorization: `Bearer ${role}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const json = (response.headers.get('content-type') ?? '').includes('json') ? await response.json() : {}
    return { status: response.status, data: json.data }
  } }
}
