import { getAdminCounters, getAdminQueue, saveAdminCounters, saveAdminQueue, type AdminCounter, type AdminQueueItem, type CounterStatus } from './adminData'

export type CounterDraft = Pick<AdminCounter, 'id' | 'name' | 'department' | 'staffMember' | 'status'>
export type CounterResult = { ok: true; counter: AdminCounter } | { ok: false; message: string }

export function createCounter(draft: CounterDraft): CounterResult {
  const counters = getAdminCounters()
  if (counters.some((counter) => counter.name.trim().toLowerCase() === draft.name.trim().toLowerCase())) return { ok: false, message: 'A counter with this name already exists.' }
  const counter: AdminCounter = { ...draft, name: draft.name.trim(), staffMember: draft.staffMember.trim(), currentToken: '-', lastUpdated: 'Just now' }
  saveAdminCounters([...counters, counter])
  return { ok: true, counter }
}

export function updateCounter(counterId: string, changes: Partial<Pick<AdminCounter, 'id' | 'name' | 'department' | 'staffMember' | 'status'>>): CounterResult {
  const counters = getAdminCounters()
  const existing = counters.find((counter) => counter.id === counterId)
  if (!existing) return { ok: false, message: 'Counter could not be found.' }
  const nextName = changes.name?.trim() ?? existing.name
  if (counters.some((counter) => counter.id !== counterId && counter.name.trim().toLowerCase() === nextName.toLowerCase())) return { ok: false, message: 'A counter with this name already exists.' }
  const counter = { ...existing, ...changes, name: nextName, staffMember: changes.staffMember?.trim() ?? existing.staffMember, lastUpdated: 'Just now' }
  saveAdminCounters(counters.map((item) => item.id === counterId ? counter : item))
  return { ok: true, counter }
}

export function assignWaitingToken(tokenId: string, counterId: string): CounterResult {
  const counters = getAdminCounters()
  const queue = getAdminQueue()
  const counter = counters.find((item) => item.id === counterId)
  const token = queue.find((item) => item.id === tokenId)
  if (!counter || !token) return { ok: false, message: 'Counter or token could not be found.' }
  if (counter.status !== 'Available') return { ok: false, message: `${counter.id} is not available for a new token.` }
  if (counter.department !== token.department) return { ok: false, message: `${token.id} belongs to ${token.department} and cannot be assigned to ${counter.department}.` }
  if (token.status !== 'Waiting') return { ok: false, message: `${token.id} is no longer waiting.` }
  const nextCounter = { ...counter, currentToken: token.id, status: 'Busy' as const, lastUpdated: 'Just now' }
  saveAdminCounters(counters.map((item) => item.id === counter.id ? nextCounter : item))
  saveAdminQueue(queue.map((item) => item.id === token.id ? { ...item, counter: counter.id, status: 'Serving' as const, waitingMinutes: 0 } : item))
  return { ok: true, counter: nextCounter }
}

export function releaseCounter(counterId: string): CounterResult {
  const counters = getAdminCounters()
  const existing = counters.find((counter) => counter.id === counterId)
  if (!existing) return { ok: false, message: 'Counter could not be found.' }
  const counter = { ...existing, currentToken: '-', status: 'Available' as CounterStatus, lastUpdated: 'Just now' }
  saveAdminCounters(counters.map((item) => item.id === counterId ? counter : item))
  if (existing.currentToken !== '-') saveAdminQueue(getAdminQueue().map((item) => item.id === existing.currentToken ? { ...item, counter: '-', status: 'Waiting' as const } : item))
  return { ok: true, counter }
}

export function getEligibleWaitingTokens(): AdminQueueItem[] {
  return getAdminQueue().filter((item) => item.status === 'Waiting')
}
