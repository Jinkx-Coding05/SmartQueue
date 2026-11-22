import { getNextAvailableDate, serviceCenters } from './bookingData'
import { getSavedQueueBookings, getQueueBooking } from './queueData'
import type { QueueBooking } from './queueData'

const APPOINTMENT_OVERRIDES_KEY = 'smartqueue.appointmentOverrides'

export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled'

export type Appointment = QueueBooking & {
  id?: string
  appointmentId: string
  doctorName: string
  status: AppointmentStatus
}

const appointmentSeed: Appointment[] = [
  { ...getQueueBooking('A-024')!, appointmentId: 'APT-A024', doctorName: 'Dr. Meera Shah', status: 'upcoming' },
  { token: 'SQ-2026-101', center: serviceCenters[1], department: 'Cardiology', visitType: 'Follow-up', date: '2026-11-15', time: '11:00 AM', estimatedWait: 0, peopleAhead: 0, currentServing: 'SQ-2026-101', counter: 'Counter 01', stage: 'completed', createdAt: '2026-11-01T09:30:00.000Z', appointmentId: 'APT-SQ101', doctorName: 'Dr. Arjun Menon', status: 'completed' },
  { token: 'SQ-2026-088', center: serviceCenters[2], department: 'Document verification', visitType: 'New Consultation', date: '2026-10-30', time: '02:00 PM', estimatedWait: 0, peopleAhead: 0, currentServing: 'SQ-2026-088', counter: 'Counter 03', stage: 'completed', createdAt: '2026-10-20T09:30:00.000Z', appointmentId: 'APT-SQ088', doctorName: 'Dr. Kavita Rao', status: 'cancelled' },
]

export function getAppointments(): Appointment[] {
  const persisted = getSavedQueueBookings().map((booking) => toAppointment(booking))
  const byId = new Map<string, Appointment>(appointmentSeed.map((appointment) => [appointment.appointmentId, appointment]))
  persisted.forEach((appointment) => byId.set(appointment.appointmentId, appointment))
  const overrides = readOverrides()
  return Array.from(byId.values()).map((appointment) => ({ ...appointment, ...overrides[appointment.appointmentId] }))
}

export function rescheduleAppointment(appointmentId: string, date: string, time: string) {
  const appointment = getAppointments().find((item) => item.appointmentId === appointmentId)
  if (!appointment || appointment.status !== 'upcoming') return null
  const updated = { ...appointment, date, time }
  saveOverride(appointmentId, { date, time })
  return updated
}

export function cancelAppointment(appointmentId: string) {
  const appointment = getAppointments().find((item) => item.appointmentId === appointmentId)
  if (!appointment || appointment.status !== 'upcoming') return null
  const updated = { ...appointment, status: 'cancelled' as const }
  saveOverride(appointmentId, { status: updated.status })
  return updated
}

export function getAppointmentMinDate() {
  return getNextAvailableDate(1)
}

function toAppointment(booking: QueueBooking): Appointment {
  const status: AppointmentStatus = booking.stage === 'completed' ? 'completed' : booking.stage === 'cancelled' || booking.stage === 'skipped' ? 'cancelled' : 'upcoming'
  return { ...booking, appointmentId: `APT-${booking.token.replace(/[^a-zA-Z0-9]/g, '')}`, doctorName: doctorForDepartment(booking.department), status }
}

function doctorForDepartment(department: string) {
  const doctors: Record<string, string> = { 'General Medicine': 'Dr. Meera Shah', Cardiology: 'Dr. Arjun Menon', Orthopedics: 'Dr. Neel Kapoor', Pediatrics: 'Dr. Aisha Khan', Dermatology: 'Dr. Kavita Rao', Ophthalmology: 'Dr. Rohan Iyer' }
  return doctors[department] ?? 'Dr. SmartQueue Care Team'
}

function readOverrides(): Record<string, Partial<Appointment>> {
  const raw = localStorage.getItem(APPOINTMENT_OVERRIDES_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, Partial<Appointment>> } catch { localStorage.removeItem(APPOINTMENT_OVERRIDES_KEY); return {} }
}

function saveOverride(appointmentId: string, changes: Partial<Appointment>) {
  const overrides = readOverrides()
  overrides[appointmentId] = { ...overrides[appointmentId], ...changes }
  localStorage.setItem(APPOINTMENT_OVERRIDES_KEY, JSON.stringify(overrides))
}
