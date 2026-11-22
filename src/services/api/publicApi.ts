import { apiRequest } from './http'

export type PublicStatisticsApi = {
  source: string
  period: 'today' | '7d' | '30d'
  summary: { tokensGenerated: number; patientsServed: number; averageEstimatedWaitMinutes: number; activeCounters: number; activeDepartments: number }
  waitingTrend: Array<{ date: string; averageEstimatedWaitMinutes: number }>
  departmentPerformance: Array<{ department: string; patientsServed: number; queueSize: number; averageEstimatedWaitMinutes: number }>
  peakHours: Array<{ hour: number; tokenCount: number }>
  serviceCenter: { name: string }
}

export function getPublicStatistics(period: PublicStatisticsApi['period']): Promise<PublicStatisticsApi> {
  return apiRequest(`/public/statistics?period=${period}`)
}
