import { apiRequest } from './http'

export type QueueDisplayEntry = { sequence: number | null; tokenId: string; department: string; priority: 'normal' | 'priority' | 'emergency'; status: 'waiting' | 'serving' | 'completed' | 'skipped'; counter: string | null; estimatedWaitingTimeMinutes: number | null; estimatedArrivalAt: string | null; closedAt?: string | null; closedSequence?: number }
export type QueueDisplayApi = { lastUpdatedAt: string; timeZone: string; refreshIntervalSeconds: number; departments: Array<{ id: string; name: string; activeCounters: string[]; entries: QueueDisplayEntry[] }> }

export async function getQueueDisplay(): Promise<QueueDisplayApi> {
  return apiRequest('/public/queue-display')
}
