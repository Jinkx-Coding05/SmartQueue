import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateQueue } from '../server/src/services/queueEstimate.ts'
import { remainingQueueMinutes } from '../src/utils/queueCountdown.ts'

const now = new Date('2026-11-22T10:00:00.000Z')
const token = (id, status, priority = 'normal', minute = 0, extra = {}) => ({ id, tokenNumber: id, status, priority, bookingDate: new Date(now.getTime() + minute * 60_000), ...extra })
const snapshot = (tokens, overrides = {}) => ({ tokens, averageServiceMinutes: 10, serviceDurationSampleCount: 3, activeCounterCount: 1, priorityEnabled: true, ...overrides })

test('estimates from same department queue, priority ordering, serving workload and active counters', () => {
  const rows = [token('late', 'waiting', 'normal', 2), token('vip', 'waiting', 'emergency', 3), token('target', 'waiting', 'normal', 4), token('serving', 'serving', 'normal', -5, { servingAt: new Date(now.getTime() - 5 * 60_000) })]
  const result = estimateQueue(snapshot(rows, { activeCounterCount: 2 }), 'target', now)
  assert.equal(result.queuePosition, 3)
  assert.equal(result.patientsAhead, 3)
  assert.equal(result.estimatedWaitingTime, 13)
  assert.equal(result.estimatedArrivalAt, '2026-11-22T10:13:00.000Z')
})

test('FIFO applies when department priority is disabled', () => {
  const rows = [token('normal-first', 'waiting', 'normal', 0), token('emergency-later', 'waiting', 'emergency', 1), token('target', 'waiting', 'normal', 2)]
  assert.equal(estimateQueue(snapshot(rows, { priorityEnabled: false }), 'target', now).queuePosition, 3)
})

test('uses configured service duration when history is insufficient and stays unavailable without counters', () => {
  const rows = [token('target', 'waiting')]
  assert.equal(estimateQueue(snapshot(rows, { averageServiceMinutes: null, serviceDurationSampleCount: 0 }), 'target', now).estimatedWaitingTime, 0)
  assert.equal(estimateQueue(snapshot(rows, { averageServiceMinutes: 10, serviceDurationSampleCount: 2 }), 'target', now).serviceDurationMinutes, 2)
  assert.equal(estimateQueue(snapshot(rows), 'target', now).serviceDurationMinutes, 10)
  assert.equal(estimateQueue(snapshot(rows, { activeCounterCount: 0 }), 'target', now).estimatedArrivalAt, null)
})

test('accounts for multiple active counters while preserving emergency priority', () => {
  const rows = [token('emergency', 'waiting', 'emergency', -3), token('target', 'waiting', 'normal', 0)]
  const result = estimateQueue(snapshot(rows, { activeCounterCount: 2, averageServiceMinutes: 8 }), 'target', now)
  assert.equal(result.patientsAhead, 1)
  assert.equal(result.estimatedWaitingTime, 4)
})

test('serving is zero now; terminal statuses leave queue estimate unavailable', () => {
  assert.equal(estimateQueue(snapshot([token('serving', 'serving')]), 'serving', now).estimatedWaitingTime, 0)
  assert.equal(estimateQueue(snapshot([token('done', 'completed')]), 'done', now).patientsAhead, null)
  assert.equal(estimateQueue(snapshot([token('cancelled', 'cancelled')]), 'cancelled', now).estimatedArrivalAt, null)
})

test('countdown decreases against stable arrival timestamp and handles invalid or elapsed dates', () => {
  const arrival = '2026-11-22T10:10:00.000Z'
  assert.equal(remainingQueueMinutes(arrival, now.getTime()), 10)
  assert.equal(remainingQueueMinutes(arrival, now.getTime() + 60_001), 9)
  assert.equal(remainingQueueMinutes(arrival, now.getTime() + 11 * 60_000), 0)
  assert.equal(remainingQueueMinutes(null, now.getTime()), null)
  assert.equal(remainingQueueMinutes('bad-date', now.getTime()), null)
})
