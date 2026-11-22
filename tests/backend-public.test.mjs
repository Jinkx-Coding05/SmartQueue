import assert from 'node:assert/strict'
import express from 'express'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import { createPublicStatisticsRouter } from '../server/src/routes/publicStatisticsRoutes.ts'
import { errorHandler } from '../server/src/middleware/errorHandler.ts'

const servers = new Set()
after(async () => Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve)))))

test('public statistics are available without auth, reject invalid filters, and return aggregate-only cacheable data', async () => {
  const app = express()
  app.use('/api/public', createPublicStatisticsRouter({ get: async (period) => ({ source: 'aggregated MongoDB token data', period, summary: { tokensGenerated: 0, patientsServed: 0, averageEstimatedWaitMinutes: 0, activeCounters: 0, activeDepartments: 0 }, waitingTrend: [], departmentPerformance: [], peakHours: [], serviceCenter: { name: 'Configured service center' } }) }))
  app.use(errorHandler)
  const server = createServer(app); servers.add(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api/public/statistics`
  const response = await fetch(`${base}?period=7d`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /max-age=60/)
  const body = await response.json()
  assert.equal(body.data.summary.tokensGenerated, 0)
  assert.equal('citizens' in body.data, false)
  assert.equal((await fetch(`${base}?period=year`)).status, 400)
})
