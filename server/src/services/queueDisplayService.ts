import { CounterModel, DepartmentModel, TokenModel } from '../models/index.ts'
import { env } from '../config/env.ts'
import { hospitalDayRange } from './citizenService.ts'
import { mongooseCitizenRepository } from './citizenRepository.ts'
import { estimateQueue } from './queueEstimate.ts'

const priorityWeight: Record<string, number> = { emergency: 0, priority: 1, normal: 2 }

export class QueueDisplayService {
  async getDisplay() {
    const now = new Date()
    const { start, end } = hospitalDayRange(now, env.hospitalTimeZone)
    const departments = await DepartmentModel.find({ isActive: true }).select('name queueSettings.priorityEnabled').sort({ name: 1 }).lean().exec()
    const queues = await Promise.all(departments.map(async (department) => {
      const departmentId = department._id.toString()
      const [snapshot, counters, recentClosed] = await Promise.all([
        mongooseCitizenRepository.getQueueSnapshot(departmentId, start, end),
        CounterModel.find({ department: department._id, status: { $in: ['active', 'available', 'busy'] } }).select('counterNumber').sort({ counterNumber: 1 }).lean().exec(),
        TokenModel.find({ department: department._id, status: { $in: ['completed', 'skipped'] }, bookingDate: { $gte: start, $lt: end } }).select('tokenNumber status priority counter bookingDate completedAt skippedAt').sort({ updatedAt: -1 }).limit(8).lean().exec(),
      ])
      const serving = snapshot.tokens.filter((item) => item.status === 'serving').sort((a, b) => a.bookingDate.getTime() - b.bookingDate.getTime())
      const waiting = snapshot.tokens.filter((item) => item.status === 'waiting').sort((a, b) => (snapshot.priorityEnabled ? priorityWeight[a.priority] - priorityWeight[b.priority] : 0) || a.bookingDate.getTime() - b.bookingDate.getTime() || a.id.localeCompare(b.id))
      const activeEntries = [...serving, ...waiting].map((item, index) => {
        const estimate = item.status === 'waiting' ? estimateQueue(snapshot, item.id, now, env.defaultServiceDurationMinutes) : null
        return {
          sequence: index + 1,
          tokenId: item.tokenNumber,
          department: department.name,
          priority: item.priority,
          status: item.status,
          counter: counters.find((counter) => counter.counterNumber && item.counterId && counter._id.toString() === item.counterId)?.counterNumber ?? null,
          estimatedWaitingTimeMinutes: item.status === 'serving' ? 0 : estimate?.estimatedWaitingTime ?? null,
          estimatedArrivalAt: estimate?.estimatedArrivalAt ?? (item.status === 'serving' ? now.toISOString() : null),
        }
      })
      const closedEntries = recentClosed.reverse().map((item, index) => ({
        sequence: null,
        tokenId: item.tokenNumber,
        department: department.name,
        priority: item.priority,
        status: item.status,
        counter: null,
        estimatedWaitingTimeMinutes: null,
        estimatedArrivalAt: null,
        closedAt: item.status === 'completed' ? item.completedAt?.toISOString() ?? null : item.skippedAt?.toISOString() ?? null,
        closedSequence: index + 1,
      }))
      return { id: departmentId, name: department.name, activeCounters: counters.map((counter) => counter.counterNumber), entries: [...activeEntries, ...closedEntries] }
    }))
    return { lastUpdatedAt: now.toISOString(), timeZone: env.hospitalTimeZone, refreshIntervalSeconds: 12, departments: queues }
  }
}

export const queueDisplayService = new QueueDisplayService()
