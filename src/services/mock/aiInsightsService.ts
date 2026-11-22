import { adminAnalytics, getAdminAppointments, getAdminCounters, getAdminQueue } from './adminData'

export type InsightRisk = 'Low' | 'Medium' | 'High'
export type RecommendationPriority = 'High' | 'Medium' | 'Low'

export type DepartmentPrediction = {
  department: string
  currentWait: number
  predictedWait: number
  queueSize: number
}

export type VolumeForecast = {
  day: string
  actual: number | null
  predicted: number
}

export type CongestionInsight = {
  department: string
  queueSize: number
  estimatedWait: number
  risk: InsightRisk
  explanation: string
}

export type DemoRecommendation = {
  title: string
  reason: string
  benefit: string
  priority: RecommendationPriority
}

export type AiInsightsSnapshot = {
  overview: {
    predictedPatientsToday: number
    expectedAverageWait: number
    peakHour: string
    congestionRisk: InsightRisk
  }
  departmentPredictions: DepartmentPrediction[]
  volumeForecast: VolumeForecast[]
  peakHours: Array<{ hour: string; volume: number }>
  peakSummary: {
    busiest: string
    lessCrowded: string
    suggestedWindows: string[]
  }
  congestion: CongestionInsight[]
  recommendations: DemoRecommendation[]
  dataInputs: string[]
}

const departments = ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Dermatology']
const baselineWaits = [18, 24, 20, 16, 14]
const forecastDays = ['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function getDemoAiInsights(): AiInsightsSnapshot {
  const queue = getAdminQueue()
  const counters = getAdminCounters()
  const appointments = getAdminAppointments()
  const waitingQueue = queue.filter((item) => item.status === 'Waiting' || item.status === 'Serving' || item.status === 'Called')
  const activeCounters = counters.filter((counter) => counter.status !== 'Inactive').length
  const availableCounters = counters.filter((counter) => counter.status === 'Available').length
  const averageWait = average(waitingQueue.map((item) => item.waitingMinutes), 22)
  const departmentPredictions = departments.map((department, index) => {
    const departmentQueue = waitingQueue.filter((item) => item.department === department)
    const queueSize = departmentQueue.length
    const currentWait = average(departmentQueue.map((item) => item.waitingMinutes), baselineWaits[index])
    const departmentCounters = counters.filter((counter) => counter.department === department && counter.status !== 'Inactive').length
    const predictedWait = Math.max(8, currentWait + Math.max(0, queueSize - departmentCounters) * 3 + (department === 'Cardiology' ? 2 : 0))
    return { department, currentWait, predictedWait, queueSize }
  })
  const congestion = departmentPredictions.map(({ department, queueSize, predictedWait }) => {
    const risk: InsightRisk = predictedWait >= 26 || queueSize >= 4 ? 'High' : predictedWait >= 19 || queueSize >= 2 ? 'Medium' : 'Low'
    const explanation = risk === 'High' ? 'Higher demo demand relative to currently active counters.' : risk === 'Medium' ? 'Queue activity may increase if arrivals continue at the current demo pace.' : 'Current demo capacity appears adequate for the observed queue.'
    return { department, queueSize, estimatedWait: predictedWait, risk, explanation }
  })
  const highRisk = congestion.filter((item) => item.risk === 'High')
  const topDepartment = [...departmentPredictions].sort((a, b) => b.predictedWait - a.predictedWait)[0]
  const peakHours = [
    { hour: '8 AM', volume: 22 }, { hour: '9 AM', volume: 41 }, { hour: '10 AM', volume: 68 },
    { hour: '11 AM', volume: 74 }, { hour: '12 PM', volume: 61 }, { hour: '1 PM', volume: 38 },
    { hour: '2 PM', volume: 49 }, { hour: '3 PM', volume: 35 }, { hour: '4 PM', volume: 27 },
  ]
  const dailyActuals = adminAnalytics.dailyVolume.map((item) => item.patients)
  const volumeForecast = forecastDays.map((day, index) => ({ day, actual: index < 4 ? dailyActuals[index] : null, predicted: dailyActuals[Math.min(index, dailyActuals.length - 1)] + (index >= 4 ? (index - 3) * 8 : 4) }))
  const recommendations: DemoRecommendation[] = [
    { title: `Consider opening an additional ${topDepartment.department} counter during peak hours.`, reason: `${topDepartment.department} has the highest illustrative predicted wait at ${topDepartment.predictedWait} minutes.`, benefit: 'May reduce queue pressure during the 10 AM - 12 PM demo window.', priority: topDepartment.predictedWait >= 26 ? 'High' : 'Medium' },
    { title: 'Reassign available staff to a department experiencing higher demand.', reason: availableCounters > 0 ? `${availableCounters} demo counter${availableCounters === 1 ? '' : 's'} are currently available.` : 'The busiest departments have fewer active counters than the demo queue requires.', benefit: 'Could balance simulated workload without adding a new counter.', priority: highRisk.length > 0 && availableCounters > 0 ? 'High' : 'Medium' },
    { title: 'Encourage citizens to select less crowded visiting periods.', reason: 'The illustrative volume curve is lower before 9 AM and after 2 PM.', benefit: 'May spread demo demand more evenly across the service day.', priority: 'Low' },
  ]
  return {
    overview: { predictedPatientsToday: Math.max(248, 248 + Math.max(0, appointments.length - 3) * 4), expectedAverageWait: Math.round(Math.max(12, averageWait + 3)), peakHour: '10 AM - 12 PM', congestionRisk: highRisk.length >= 2 ? 'High' : highRisk.length === 1 ? 'Medium' : 'Low' },
    departmentPredictions,
    volumeForecast,
    peakHours,
    peakSummary: { busiest: '10 AM - 12 PM', lessCrowded: '8 AM - 9 AM and 3 PM - 4 PM', suggestedWindows: ['Before 9 AM', '1 PM - 2 PM', 'After 3 PM'] },
    congestion,
    recommendations,
    dataInputs: [`${queue.length} queue records`, `${activeCounters} active demo counters`, `${appointments.length} appointment records`, 'Fixed service-time baselines by department'],
  }
}

function average(values: number[], fallback: number) {
  if (!values.length) return fallback
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length)
}
