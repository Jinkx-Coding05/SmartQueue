import { getAppointments, type Appointment } from './appointmentService'
import { getQueueBooking, getSavedQueueBookings, saveQueueBooking, type QueueBooking, type QueueStage } from './queueData'

export type QueuePriority = 'Normal' | 'Priority' | 'Emergency'
export type QueueStatus = 'Waiting' | 'Called' | 'Serving' | 'Completed' | 'Skipped' | 'Cancelled'
export type CounterStatus = 'Available' | 'Busy' | 'Inactive' | 'Maintenance'

export type AdminQueueItem = {
  recordId?: string
  id: string
  patientName: string
  department: string
  priority: QueuePriority
  waitingMinutes: number
  counter: string
  status: QueueStatus
  visitType?: string
  bookingTime?: string
}

export type AdminCounter = {
  recordId?: string
  id: string
  name: string
  department: string
  staffMember: string
  currentToken: string
  status: CounterStatus
  lastUpdated: string
}

export type AdminAppointment = Omit<Pick<Appointment, 'appointmentId' | 'doctorName' | 'department' | 'date' | 'time' | 'status'>, 'status'> & {
  recordId?: string
  patientName: string
  status: Appointment['status'] | 'confirmed'
}

export const initialAdminQueue: AdminQueueItem[] = [
  { id: 'A-019', patientName: 'Riya Sharma', department: 'General Medicine', priority: 'Normal', waitingMinutes: 11, counter: 'Counter 01', status: 'Serving', visitType: 'Follow-up', bookingTime: '9:10 AM' },
  { id: 'A-020', patientName: 'Vikram Patel', department: 'Cardiology', priority: 'Priority', waitingMinutes: 18, counter: 'Counter 02', status: 'Waiting', visitType: 'New Consultation', bookingTime: '9:24 AM' },
  { id: 'A-021', patientName: 'Anita Rao', department: 'Pediatrics', priority: 'Normal', waitingMinutes: 22, counter: 'Counter 03', status: 'Waiting', visitType: 'Follow-up', bookingTime: '9:31 AM' },
  { id: 'A-022', patientName: 'Suresh Kumar', department: 'Orthopedics', priority: 'Emergency', waitingMinutes: 4, counter: 'Counter 01', status: 'Waiting', visitType: 'Emergency', bookingTime: '9:42 AM' },
  { id: 'A-023', patientName: 'Neha Joshi', department: 'Dermatology', priority: 'Normal', waitingMinutes: 27, counter: 'Counter 02', status: 'Waiting', visitType: 'New Consultation', bookingTime: '9:47 AM' },
  { id: 'A-024', patientName: 'Demo Citizen', department: 'General Medicine', priority: 'Normal', waitingMinutes: 31, counter: 'Counter 02', status: 'Waiting', visitType: 'New Consultation', bookingTime: '9:55 AM' },
]

export const initialAdminCounters: AdminCounter[] = [
  { id: 'Counter 01', name: 'General Medicine Desk', department: 'General Medicine', staffMember: 'Dr. Meera Shah', currentToken: 'A-019', status: 'Busy', lastUpdated: 'Just now' },
  { id: 'Counter 02', name: 'Cardiology Desk', department: 'Cardiology', staffMember: 'Dr. Arjun Menon', currentToken: 'A-020', status: 'Busy', lastUpdated: '4 minutes ago' },
  { id: 'Counter 03', name: 'Pediatrics Desk', department: 'Pediatrics', staffMember: 'Dr. Aisha Khan', currentToken: '-', status: 'Available', lastUpdated: '8 minutes ago' },
  { id: 'Counter 04', name: 'Support Desk', department: 'Dermatology', staffMember: 'Nisha Verma', currentToken: '-', status: 'Inactive', lastUpdated: 'Today, 8:30 AM' },
]

const ADMIN_QUEUE_KEY = 'smartqueue.adminQueue'
const ADMIN_COUNTERS_KEY = 'smartqueue.adminCounters'

export function getAdminQueue(): AdminQueueItem[] {
  const saved = readStorage<AdminQueueItem[]>(ADMIN_QUEUE_KEY)
  const byId = new Map<string, AdminQueueItem>((saved ?? initialAdminQueue).map((item) => [item.id, item]))

  getSavedQueueBookings().forEach((booking) => {
    if (!byId.has(booking.token)) byId.set(booking.token, queueBookingToAdminItem(booking))
  })

  return Array.from(byId.values())
}

export function getNextAssignableQueueItem(queue: AdminQueueItem[], counters: AdminCounter[]) {
  const waiting = queue.filter((item) => item.status === 'Waiting').sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.waitingMinutes - b.waitingMinutes)
  for (const item of waiting) {
    const counter = counters.find((candidate) => candidate.status === 'Available' && candidate.department === item.department)
    if (counter) return { item, counter }
  }
  return null
}

export function saveAdminQueue(queue: AdminQueueItem[]) {
  localStorage.setItem(ADMIN_QUEUE_KEY, JSON.stringify(queue))
  const bookingsById = new Map(getSavedQueueBookings().map((booking) => [booking.token, booking]))
  queue.forEach((item) => {
    const booking = bookingsById.get(item.id) ?? getQueueBooking(item.id)
    if (!booking) return
    const stage: QueueStage = item.status === 'Serving' || item.status === 'Called' ? 'your-turn'
      : item.status === 'Completed' ? 'completed'
        : item.status === 'Skipped' ? 'skipped'
          : item.status === 'Cancelled' ? 'cancelled' : 'waiting'
    saveQueueBooking({
      ...booking,
      stage,
      counter: item.counter,
      estimatedWait: item.waitingMinutes,
      peopleAhead: stage === 'your-turn' ? 0 : booking.peopleAhead,
      currentServing: stage === 'your-turn' ? item.id : booking.currentServing,
    })
  })
}

export function getAdminCounters(): AdminCounter[] {
  const saved = readStorage<AdminCounter[]>(ADMIN_COUNTERS_KEY) ?? []
  const savedById = new Map(saved.map((counter) => [counter.id, counter]))
  return initialAdminCounters.map((counter) => ({ ...counter, ...savedById.get(counter.id) })).concat(saved.filter((counter) => !initialAdminCounters.some((initial) => initial.id === counter.id)))
}

export function saveAdminCounters(counters: AdminCounter[]) {
  localStorage.setItem(ADMIN_COUNTERS_KEY, JSON.stringify(counters))
}

function queueBookingToAdminItem(booking: QueueBooking): AdminQueueItem {
  return {
    id: booking.token,
    patientName: 'Demo Citizen',
    department: booking.department,
    priority: booking.visitType === 'Emergency' ? 'Emergency' : 'Normal',
    waitingMinutes: booking.estimatedWait,
    counter: booking.counter,
    status: booking.stage === 'completed' ? 'Completed' : booking.stage === 'cancelled' ? 'Cancelled' : booking.stage === 'skipped' ? 'Skipped' : booking.stage === 'your-turn' ? 'Serving' : 'Waiting',
    visitType: booking.visitType,
    bookingTime: booking.time,
  }
}

function priorityRank(priority: QueuePriority) {
  return priority === 'Emergency' ? 0 : priority === 'Priority' ? 1 : 2
}

function readStorage<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { localStorage.removeItem(key); return null }
}

export function getAdminAppointments(): AdminAppointment[] {
  return getAppointments().slice(0, 3).map((appointment, index) => ({
    appointmentId: appointment.appointmentId,
    doctorName: appointment.doctorName,
    department: appointment.department,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    patientName: ['Demo Citizen', 'Vikram Patel', 'Anita Rao'][index] ?? 'Demo Citizen',
  }))
}

export const adminAnalytics = {
  dailyVolume: [
    { day: 'Mon', patients: 198 }, { day: 'Tue', patients: 224 }, { day: 'Wed', patients: 212 },
    { day: 'Thu', patients: 248 }, { day: 'Fri', patients: 236 }, { day: 'Sat', patients: 172 },
  ],
  departmentDistribution: [
    { department: 'General Medicine', patients: 92 }, { department: 'Cardiology', patients: 44 },
    { department: 'Orthopedics', patients: 38 }, { department: 'Pediatrics', patients: 46 }, { department: 'Dermatology', patients: 28 },
  ],
  averageWait: [
    { day: 'Mon', minutes: 24 }, { day: 'Tue', minutes: 21 }, { day: 'Wed', minutes: 23 },
    { day: 'Thu', minutes: 22 }, { day: 'Fri', minutes: 20 }, { day: 'Sat', minutes: 18 },
  ],
}
