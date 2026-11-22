import { getAdminAppointments, getAdminCounters, getAdminQueue } from './adminData'

export type ReportRange = 'today' | 'last7' | 'last30' | 'custom'

export type ReportFilters = {
  range: ReportRange
  department: string
  startDate?: string
  endDate?: string
}

export type ReportSnapshot = {
  rangeLabel: string
  dateStart: string
  dateEnd: string
  summary: {
    totalPatients: number
    completedTokens: number
    averageWaitingTime: number
    averageServiceTime: number
    completionRate: number
    cancelledTokens: number
  }
  dailyTraffic: { date: string; label: string; patients: number }[]
  departmentDistribution: { department: string; patients: number }[]
  statusBreakdown: { status: string; count: number }[]
  waitingComparison: { department: string; waiting: number; service: number }[]
  hourlyTraffic: { hour: string; patients: number }[]
  departmentPerformance: DepartmentPerformance[]
}

export type DepartmentPerformance = {
  department: string
  totalPatients: number
  averageWaitingTime: number
  averageServiceTime: number
  completedTokens: number
  pendingTokens: number
}

const departments = ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Dermatology']
const dailyPatientBase = [198, 224, 212, 248, 236, 172, 205, 218, 231, 244, 226, 188, 210, 219, 237, 249, 232, 181, 203, 217, 229, 241, 235, 176, 207, 221, 233, 246, 228, 190]
const departmentBase = [92, 44, 38, 46, 28]
const waitingBase = [24, 21, 23, 20, 18]
const serviceBase = [12, 16, 15, 13, 11]
const hourlyBase = [18, 28, 46, 72, 84, 77, 62, 55, 48]

export function getAdminReportSnapshot(filters: ReportFilters): ReportSnapshot {
  const dates = getDateRange(filters)
  const days = dates.length
  const sharedQueue = getAdminQueue()
  const sharedCounters = getAdminCounters()
  const sharedAppointments = getAdminAppointments()
  const activeCounterAdjustment = Math.max(0, sharedCounters.filter((counter) => counter.status !== 'Inactive').length - 3)
  const queueAdjustment = Math.max(0, sharedQueue.length - 6)
  const appointmentAdjustment = Math.max(0, sharedAppointments.length - 3)
  const scale = days === 1 ? 0.12 : days === 7 ? 0.27 : days === 30 ? 1 : Math.max(0.12, Math.min(1, days / 30))
  const visibleDepartments = filters.department === 'All Departments' ? departments : departments.filter((department) => department === filters.department)
  const performance = visibleDepartments.map((department) => {
    const index = departments.indexOf(department)
    const totalPatients = Math.max(1, Math.round(departmentBase[index] * days + (days === 1 ? queueAdjustment : appointmentAdjustment)))
    const completedTokens = Math.max(0, Math.round(totalPatients * ([.74, .7, .68, .76, .72][index])))
    return {
      department,
      totalPatients,
      averageWaitingTime: waitingBase[index] + (activeCounterAdjustment === 0 ? 0 : -activeCounterAdjustment),
      averageServiceTime: serviceBase[index],
      completedTokens,
      pendingTokens: Math.max(0, totalPatients - completedTokens),
    }
  })
  const totalPatients = performance.reduce((total, item) => total + item.totalPatients, 0)
  const completedTokens = performance.reduce((total, item) => total + item.completedTokens, 0)
  const pendingTokens = performance.reduce((total, item) => total + item.pendingTokens, 0)
  const cancelledTokens = Math.max(1, Math.round(totalPatients * .07))
  const dailyTraffic = dates.map((date, index) => ({ date, label: formatShortDate(date), patients: Math.max(1, Math.round((dailyPatientBase[(dailyPatientBase.length - days + index + 30) % 30] ?? 210) * scale + queueAdjustment)) }))
  const waitingComparison = performance.map((item) => ({ department: item.department, waiting: item.averageWaitingTime, service: item.averageServiceTime }))
  const distribution = performance.map((item) => ({ department: item.department, patients: item.totalPatients }))
  const statusBreakdown = [
    { status: 'Completed', count: completedTokens },
    { status: 'Pending', count: pendingTokens },
    { status: 'Cancelled', count: cancelledTokens },
    { status: 'Serving', count: Math.max(1, Math.round(totalPatients * .04)) },
  ]
  const hourlyTraffic = hourlyBase.map((patients, index) => ({ hour: formatHour(index + 8), patients: Math.max(1, Math.round(patients * (0.75 + scale * .35))) }))
  const averageWaitingTime = Math.round(performance.reduce((total, item) => total + item.averageWaitingTime * item.totalPatients, 0) / Math.max(1, totalPatients))
  const averageServiceTime = Math.round(performance.reduce((total, item) => total + item.averageServiceTime * item.totalPatients, 0) / Math.max(1, totalPatients))
  return {
    rangeLabel: getRangeLabel(filters, days),
    dateStart: dates[0],
    dateEnd: dates[dates.length - 1],
    summary: { totalPatients, completedTokens, averageWaitingTime, averageServiceTime, completionRate: Math.round((completedTokens / Math.max(1, totalPatients)) * 100), cancelledTokens },
    dailyTraffic,
    departmentDistribution: distribution,
    statusBreakdown,
    waitingComparison,
    hourlyTraffic,
    departmentPerformance: performance,
  }
}

export function getReportDateDefaults() {
  const end = toIsoDate(new Date())
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 6)
  return { startDate: toIsoDate(startDate), endDate: end }
}

function getDateRange(filters: ReportFilters): string[] {
  const end = filters.range === 'custom' && filters.endDate ? filters.endDate : toIsoDate(new Date())
  const days = filters.range === 'today' ? 1 : filters.range === 'last7' ? 7 : filters.range === 'last30' ? 30 : 30
  const start = filters.range === 'custom' && filters.startDate ? filters.startDate : shiftDate(end, -(days - 1))
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return [toIsoDate(new Date())]
  const dates: string[] = []
  const cursor = new Date(startDate)
  while (cursor <= endDate && dates.length < 31) { dates.push(toIsoDate(cursor)); cursor.setDate(cursor.getDate() + 1) }
  return dates.length ? dates : [toIsoDate(new Date())]
}

function getRangeLabel(filters: ReportFilters, days: number) { if (filters.range === 'today') return 'Today'; if (filters.range === 'last7') return 'Last 7 Days'; if (filters.range === 'last30') return 'Last 30 Days'; return `Custom · ${days} day${days === 1 ? '' : 's'}` }
function shiftDate(date: string, amount: number) { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + amount); return toIsoDate(value) }
function toIsoDate(date: Date) { return date.toISOString().slice(0, 10) }
function formatShortDate(date: string) { return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`)) }
function formatHour(hour: number) { const period = hour < 12 ? 'AM' : 'PM'; const displayHour = hour % 12 || 12; return `${displayHour} ${period}` }
