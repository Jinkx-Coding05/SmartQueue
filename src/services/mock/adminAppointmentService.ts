import { getAppointments, getAppointmentMinDate, rescheduleAppointment, cancelAppointment } from './appointmentService'
import { timeSlots } from './bookingData'

export type AdminAppointmentStatus = 'pending' | 'upcoming' | 'confirmed' | 'completed' | 'cancelled'
export type AdminAppointmentPriority = 'Normal' | 'Priority' | 'Emergency'

export type AdminAppointmentRecord = {
  recordId?: string
  appointmentId: string
  department: string
  date: string
  time: string
  doctorName: string
  patientName: string
  contactNumber: string
  priority: AdminAppointmentPriority
  status: AdminAppointmentStatus
}

type AppointmentOverride = { status?: AdminAppointmentStatus; date?: string; time?: string }

const OVERRIDES_KEY = 'smartqueue.adminAppointmentOverrides'
const defaultPendingIds = ['APT-A024']
const contactNumbers: Record<string, string> = {
  'APT-A024': '+91 98765 43210',
  'APT-SQ101': '+91 98220 11445',
  'APT-SQ088': '+91 97654 88012',
}
const patientNames: Record<string, string> = {
  'APT-A024': 'Demo Citizen',
  'APT-SQ101': 'Vikram Patel',
  'APT-SQ088': 'Anita Rao',
}
const priorities: Record<string, AdminAppointmentPriority> = {
  'APT-A024': 'Priority',
  'APT-SQ101': 'Normal',
  'APT-SQ088': 'Normal',
}

export function getAdminAppointments(): AdminAppointmentRecord[] {
  const overrides = readOverrides()
  return getAppointments().map((appointment) => {
    const override = overrides[appointment.appointmentId]
    const defaultStatus: AdminAppointmentStatus = defaultPendingIds.includes(appointment.appointmentId) && !override?.status ? 'pending' : appointment.status
    return {
      ...appointment,
      ...override,
      patientName: patientNames[appointment.appointmentId] ?? 'Demo Citizen',
      contactNumber: contactNumbers[appointment.appointmentId] ?? '+91 90000 00000',
      priority: priorities[appointment.appointmentId] ?? (appointment.visitType === 'Emergency' ? 'Emergency' : 'Normal'),
      status: override?.status ?? defaultStatus,
    }
  })
}

export function approveAdminAppointment(appointmentId: string): AdminAppointmentRecord | null {
  return updateStatus(appointmentId, 'confirmed')
}

export function completeAdminAppointment(appointmentId: string): AdminAppointmentRecord | null {
  return updateStatus(appointmentId, 'completed')
}

export function cancelAdminAppointment(appointmentId: string): AdminAppointmentRecord | null {
  const updated = cancelAppointment(appointmentId)
  if (!updated) return null
  return updateStatus(appointmentId, 'cancelled')
}

export function rescheduleAdminAppointment(appointmentId: string, date: string, time: string): AdminAppointmentRecord | null {
  if (!date || date < getAppointmentMinDate() || !timeSlots.some((slot) => slot.available && slot.label === time)) return null
  const updated = rescheduleAppointment(appointmentId, date, time)
  if (!updated) return null
  const overrides = readOverrides()
  saveOverrides({ ...overrides, [appointmentId]: { ...overrides[appointmentId], date, time } })
  return getAdminAppointments().find((appointment) => appointment.appointmentId === appointmentId) ?? null
}

export function getAdminAppointmentMinDate() {
  return getAppointmentMinDate()
}

export const adminAppointmentTimeSlots = timeSlots.filter((slot) => slot.available)

function updateStatus(appointmentId: string, status: AdminAppointmentStatus): AdminAppointmentRecord | null {
  const appointment = getAdminAppointments().find((item) => item.appointmentId === appointmentId)
  if (!appointment) return null
  const overrides = readOverrides()
  saveOverrides({ ...overrides, [appointmentId]: { ...overrides[appointmentId], status } })
  return { ...appointment, status }
}

function readOverrides(): Record<string, AppointmentOverride> {
  const raw = localStorage.getItem(OVERRIDES_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, AppointmentOverride> } catch { localStorage.removeItem(OVERRIDES_KEY); return {} }
}

function saveOverrides(overrides: Record<string, AppointmentOverride>) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
}
