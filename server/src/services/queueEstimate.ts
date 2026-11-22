import type { QueueSnapshot } from './citizenRepository.ts'

export const MIN_SERVICE_DURATION_SAMPLES = 3

export function estimateQueue(snapshot: QueueSnapshot, tokenId: string, now = new Date(), defaultServiceDurationMinutes = 2) {
  const hasSufficientHistory = snapshot.serviceDurationSampleCount >= MIN_SERVICE_DURATION_SAMPLES && Number.isFinite(snapshot.averageServiceMinutes) && (snapshot.averageServiceMinutes ?? 0) > 0
  const avg = hasSufficientHistory ? snapshot.averageServiceMinutes! : defaultServiceDurationMinutes
  const target = snapshot.tokens.find((token) => token.id === tokenId)
  if (!target) return { queuePosition: null, patientsAhead: null, estimatedWaitingTime: null, estimatedArrivalAt: null, serviceDurationMinutes: avg, serviceDurationSource: hasSufficientHistory ? 'historical' as const : 'default' as const }
  if (target.status !== 'waiting') {
    return { queuePosition: null, patientsAhead: target.status === 'serving' ? 0 : null, estimatedWaitingTime: target.status === 'serving' ? 0 : null, estimatedArrivalAt: target.status === 'serving' ? now.toISOString() : null, serviceDurationMinutes: avg, serviceDurationSource: hasSufficientHistory ? 'historical' as const : 'default' as const }
  }
  const sameLane = (other: QueueSnapshot['tokens'][number]) => !target.counterId || !other.counterId || target.counterId === other.counterId
  const serving = snapshot.tokens.filter((item) => item.status === 'serving' && sameLane(item))
  const waiting = snapshot.tokens.filter((item) => item.status === 'waiting' && sameLane(item))
  const weight = (priority: string) => priority === 'emergency' ? 0 : priority === 'priority' ? 1 : 2
  waiting.sort((a, b) => (snapshot.priorityEnabled ? weight(a.priority) - weight(b.priority) : 0) || a.bookingDate.getTime() - b.bookingDate.getTime() || a.id.localeCompare(b.id))
  const index = waiting.findIndex((item) => item.id === tokenId)
  const before = Math.max(0, index)
  const ahead = before + serving.length
  if (!Number.isFinite(avg) || avg <= 0 || snapshot.activeCounterCount < 1) return { queuePosition: before + 1, patientsAhead: ahead, estimatedWaitingTime: null, estimatedArrivalAt: null, serviceDurationMinutes: avg, serviceDurationSource: hasSufficientHistory ? 'historical' as const : 'default' as const }
  const laneCounters = target.counterId ? 1 : snapshot.activeCounterCount
  const remaining = serving.reduce((total, item) => {
    const elapsed = item.servingAt ? Math.max(0, (now.getTime() - item.servingAt.getTime()) / 60000) : 0
    return total + Math.max(0, avg - elapsed)
  }, 0)
  const minutes = Math.ceil(Math.max(0, remaining + before * avg) / laneCounters)
  return { queuePosition: before + 1, patientsAhead: ahead, estimatedWaitingTime: minutes, estimatedArrivalAt: new Date(now.getTime() + minutes * 60000).toISOString(), serviceDurationMinutes: avg, serviceDurationSource: hasSufficientHistory ? 'historical' as const : 'default' as const }
}
