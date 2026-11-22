import { CounterModel, DepartmentModel, HospitalSettingsModel, TokenModel } from '../models/index.ts'

export type StatisticsPeriod = 'today' | '7d' | '30d'

export class PublicStatisticsService {
  async get(period: StatisticsPeriod) {
    const now = new Date()
    const start = new Date(now)
    start.setUTCHours(0, 0, 0, 0)
    if (period === '7d') start.setUTCDate(start.getUTCDate() - 6)
    if (period === '30d') start.setUTCDate(start.getUTCDate() - 29)
    const match = { bookingDate: { $gte: start, $lte: now } }
    const [statusCounts, daily, departments, hourly, activeCounters, activeDepartments, settings] = await Promise.all([
      TokenModel.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 }, avgEstimatedWait: { $avg: '$estimatedWaitingTime' } } }]),
      TokenModel.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } }, count: { $sum: 1 }, avgWait: { $avg: '$estimatedWaitingTime' } } }, { $sort: { _id: 1 } }]),
      TokenModel.aggregate([{ $match: match }, { $group: { _id: '$department', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, waiting: { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } }, avgWait: { $avg: '$estimatedWaitingTime' } } }, { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } }, { $unwind: '$department' }, { $project: { name: '$department.name', total: 1, completed: 1, waiting: 1, avgWait: 1 } }, { $sort: { total: -1 } }]),
      TokenModel.aggregate([{ $match: match }, { $group: { _id: { $hour: '$bookingDate' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      CounterModel.countDocuments({ status: { $in: ['active', 'available'] } }),
      DepartmentModel.countDocuments({ isActive: true }),
      HospitalSettingsModel.findOne({ singleton: 'global' }).select('hospitalName').lean(),
    ])
    const count = statusCounts.reduce((sum: number, row: { count: number }) => sum + row.count, 0)
    const completed = statusCounts.find((row: { _id: string }) => row._id === 'completed')?.count ?? 0
    const weightedWait = statusCounts.reduce((sum: number, row: { count: number; avgEstimatedWait?: number }) => sum + row.count * (row.avgEstimatedWait ?? 0), 0)
    return {
      source: 'aggregated MongoDB token data', period,
      summary: { tokensGenerated: count, patientsServed: completed, averageEstimatedWaitMinutes: count ? Math.round(weightedWait / count) : 0, activeCounters, activeDepartments },
      waitingTrend: daily.map((row: { _id: string; avgWait?: number }) => ({ date: row._id, averageEstimatedWaitMinutes: Math.round(row.avgWait ?? 0) })),
      departmentPerformance: departments.map((row: { name: string; completed: number; waiting: number; avgWait?: number }) => ({ department: row.name, patientsServed: row.completed, queueSize: row.waiting, averageEstimatedWaitMinutes: Math.round(row.avgWait ?? 0) })),
      peakHours: hourly.map((row: { _id: number; count: number }) => ({ hour: row._id, tokenCount: row.count })),
      serviceCenter: { name: settings?.hospitalName ?? 'Configured service center' },
    }
  }
}

export const publicStatisticsService = new PublicStatisticsService()
