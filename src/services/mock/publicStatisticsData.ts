export type StatisticsPeriod = 'today' | '7d' | '30d'

export type DepartmentPerformance = {
  department: string
  averageWait: number
  patientsServed: number
  queueSize: number
  performance: 'Good' | 'Monitor' | 'Busy'
}

export type ServiceCenterStats = {
  name: string
  location: string
  patientsServed: number
  averageWait: number
  queueSize: number
}

export type StatisticsSnapshot = {
  summary: {
    tokensGenerated: string
    patientsServed: string
    averageWait: string
    activeCenters: string
  }
  waitingTrend: Array<{ label: string; wait: number }>
  departmentPerformance: DepartmentPerformance[]
  serviceCenters: ServiceCenterStats[]
  peakHours: Array<{ hour: string; volume: number }>
}

const snapshots: Record<StatisticsPeriod, StatisticsSnapshot> = {
  today: {
    summary: { tokensGenerated: '486', patientsServed: '392', averageWait: '16 min', activeCenters: '8' },
    waitingTrend: [
      { label: '8 AM', wait: 10 }, { label: '10 AM', wait: 18 }, { label: '12 PM', wait: 22 },
      { label: '2 PM', wait: 16 }, { label: '4 PM', wait: 12 },
    ],
    departmentPerformance: [
      { department: 'General Medicine', averageWait: 18, patientsServed: 126, queueSize: 14, performance: 'Monitor' },
      { department: 'Cardiology', averageWait: 21, patientsServed: 58, queueSize: 9, performance: 'Busy' },
      { department: 'Orthopedics', averageWait: 15, patientsServed: 72, queueSize: 7, performance: 'Good' },
      { department: 'Pediatrics', averageWait: 13, patientsServed: 81, queueSize: 6, performance: 'Good' },
      { department: 'Dermatology', averageWait: 12, patientsServed: 55, queueSize: 4, performance: 'Good' },
    ],
    serviceCenters: [
      { name: 'City General Demo Center', location: 'Downtown', patientsServed: 164, averageWait: 17, queueSize: 18 },
      { name: 'Community Health Demo Hub', location: 'Westside', patientsServed: 123, averageWait: 14, queueSize: 11 },
      { name: 'Civic Care Demo Center', location: 'East Wing', patientsServed: 105, averageWait: 16, queueSize: 9 },
    ],
    peakHours: [
      { hour: '8 AM', volume: 32 }, { hour: '9 AM', volume: 56 }, { hour: '10 AM', volume: 78 },
      { hour: '11 AM', volume: 84 }, { hour: '12 PM', volume: 63 }, { hour: '1 PM', volume: 48 },
      { hour: '2 PM', volume: 55 }, { hour: '3 PM', volume: 42 }, { hour: '4 PM', volume: 31 },
    ],
  },
  '7d': {
    summary: { tokensGenerated: '3,248', patientsServed: '2,916', averageWait: '19 min', activeCenters: '12' },
    waitingTrend: [
      { label: 'Mon', wait: 21 }, { label: 'Tue', wait: 18 }, { label: 'Wed', wait: 20 },
      { label: 'Thu', wait: 17 }, { label: 'Fri', wait: 22 }, { label: 'Sat', wait: 16 }, { label: 'Sun', wait: 15 },
    ],
    departmentPerformance: [
      { department: 'General Medicine', averageWait: 20, patientsServed: 842, queueSize: 31, performance: 'Monitor' },
      { department: 'Cardiology', averageWait: 25, patientsServed: 364, queueSize: 19, performance: 'Busy' },
      { department: 'Orthopedics', averageWait: 18, patientsServed: 492, queueSize: 16, performance: 'Good' },
      { department: 'Pediatrics', averageWait: 16, patientsServed: 611, queueSize: 13, performance: 'Good' },
      { department: 'Dermatology', averageWait: 15, patientsServed: 328, queueSize: 9, performance: 'Good' },
    ],
    serviceCenters: [
      { name: 'City General Demo Center', location: 'Downtown', patientsServed: 1218, averageWait: 20, queueSize: 42 },
      { name: 'Community Health Demo Hub', location: 'Westside', patientsServed: 934, averageWait: 17, queueSize: 31 },
      { name: 'Civic Care Demo Center', location: 'East Wing', patientsServed: 764, averageWait: 19, queueSize: 26 },
    ],
    peakHours: [
      { hour: '8 AM', volume: 124 }, { hour: '9 AM', volume: 198 }, { hour: '10 AM', volume: 276 },
      { hour: '11 AM', volume: 302 }, { hour: '12 PM', volume: 242 }, { hour: '1 PM', volume: 186 },
      { hour: '2 PM', volume: 215 }, { hour: '3 PM', volume: 173 }, { hour: '4 PM', volume: 138 },
    ],
  },
  '30d': {
    summary: { tokensGenerated: '12,840', patientsServed: '11,706', averageWait: '21 min', activeCenters: '15' },
    waitingTrend: [
      { label: 'Week 1', wait: 23 }, { label: 'Week 2', wait: 21 }, { label: 'Week 3', wait: 22 }, { label: 'Week 4', wait: 19 },
    ],
    departmentPerformance: [
      { department: 'General Medicine', averageWait: 22, patientsServed: 3420, queueSize: 46, performance: 'Monitor' },
      { department: 'Cardiology', averageWait: 27, patientsServed: 1420, queueSize: 28, performance: 'Busy' },
      { department: 'Orthopedics', averageWait: 20, patientsServed: 1985, queueSize: 22, performance: 'Monitor' },
      { department: 'Pediatrics', averageWait: 18, patientsServed: 2610, queueSize: 18, performance: 'Good' },
      { department: 'Dermatology', averageWait: 17, patientsServed: 1375, queueSize: 13, performance: 'Good' },
    ],
    serviceCenters: [
      { name: 'City General Demo Center', location: 'Downtown', patientsServed: 4860, averageWait: 23, queueSize: 61 },
      { name: 'Community Health Demo Hub', location: 'Westside', patientsServed: 3716, averageWait: 19, queueSize: 45 },
      { name: 'Civic Care Demo Center', location: 'East Wing', patientsServed: 3130, averageWait: 21, queueSize: 37 },
    ],
    peakHours: [
      { hour: '8 AM', volume: 462 }, { hour: '9 AM', volume: 718 }, { hour: '10 AM', volume: 956 },
      { hour: '11 AM', volume: 1024 }, { hour: '12 PM', volume: 814 }, { hour: '1 PM', volume: 632 },
      { hour: '2 PM', volume: 704 }, { hour: '3 PM', volume: 568 }, { hour: '4 PM', volume: 421 },
    ],
  },
}

export function getStatisticsSnapshot(period: StatisticsPeriod): StatisticsSnapshot {
  return snapshots[period]
}
