import assert from 'node:assert/strict'
import express from 'express'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import { createQueueDisplayRouter } from '../server/src/routes/queueDisplayRoutes.ts'
import { errorHandler } from '../server/src/middleware/errorHandler.ts'

const servers = new Set()
after(async () => Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve)))))

test('public queue display needs no login, exposes queue-only fields, and disables caching', async () => {
  const app = express()
  app.use('/api/public', createQueueDisplayRouter({ getDisplay: async () => ({ lastUpdatedAt: new Date().toISOString(), timeZone: 'Asia/Kolkata', refreshIntervalSeconds: 12, departments: [{ id: 'dept-1', name: 'General Medicine', activeCounters: ['CTR-1'], entries: [{ sequence: 1, tokenId: 'SQ-20261122-ABCDEF', department: 'General Medicine', priority: 'normal', status: 'waiting', counter: 'CTR-1', estimatedWaitingTimeMinutes: 2, estimatedArrivalAt: new Date().toISOString() }] }] }) }))
  app.use(errorHandler)
  const server = createServer(app)
  servers.add(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/public/queue-display')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.equal(body.data.refreshIntervalSeconds, 12)
  const entry = body.data.departments[0].entries[0]
  assert.equal(entry.tokenId, 'SQ-20261122-ABCDEF')
  assert.equal('patientName' in entry, false)
  assert.equal('phoneNumber' in entry, false)
  assert.equal('citizen' in entry, false)
})
