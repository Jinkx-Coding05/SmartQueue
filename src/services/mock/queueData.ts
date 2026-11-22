import type { ServiceCenter } from './bookingData'

const QUEUE_BOOKINGS_KEY = 'smartqueue.queueBookings'

export type QueueStage = 'booked' | 'checked-in' | 'waiting' | 'your-turn' | 'completed' | 'skipped' | 'cancelled'

export type QueueBooking = {
  token: string
  center: ServiceCenter
  department: string
  visitType: string
  date: string
  time: string
  estimatedWait: number
  peopleAhead: number
  currentServing: string
  counter: string
  stage: QueueStage
  createdAt: string
}

const demoQueueBooking: QueueBooking = {
  token: 'A-024',
  center: { id: 'city-general', name: 'City General Hospital', location: 'Central Avenue, Downtown', services: ['Outpatient care', 'Diagnostics', 'Vaccination'] },
  department: 'General Medicine',
  visitType: 'New Consultation',
  date: '2026-11-25',
  time: '10:30 AM',
  estimatedWait: 18,
  peopleAhead: 5,
  currentServing: 'A-019',
  counter: 'Counter 02',
  stage: 'waiting',
  createdAt: new Date().toISOString(),
}

export function saveQueueBooking(booking: QueueBooking) {
  const bookings = readBookings()
  bookings[booking.token] = booking
  localStorage.setItem(QUEUE_BOOKINGS_KEY, JSON.stringify(bookings))
}

export function getQueueBooking(token: string): QueueBooking | null {
  if (token === demoQueueBooking.token) return readBookings()[token] ?? demoQueueBooking
  return readBookings()[token] ?? null
}

export function getSavedQueueBookings() {
  return Object.values(readBookings())
}

export function advanceQueue(booking: QueueBooking): QueueBooking {
  if (booking.stage === 'completed' || booking.stage === 'skipped' || booking.stage === 'cancelled') return booking

  if (booking.peopleAhead > 0) {
    const nextPeopleAhead = Math.max(booking.peopleAhead - 1, 0)
    return {
      ...booking,
      peopleAhead: nextPeopleAhead,
      estimatedWait: Math.max(booking.estimatedWait - 3, 0),
      currentServing: advanceServingToken(booking.currentServing),
      stage: nextPeopleAhead === 0 ? 'your-turn' : booking.stage,
    }
  }

  return { ...booking, estimatedWait: 0, stage: 'completed' }
}

function advanceServingToken(token: string) {
  const match = token.match(/^(.*?)(\d+)$/)
  if (!match) return token
  return `${match[1]}${String(Number(match[2]) + 1).padStart(match[2].length, '0')}`
}

function readBookings(): Record<string, QueueBooking> {
  const raw = localStorage.getItem(QUEUE_BOOKINGS_KEY)
  if (!raw) return {}

  try {
    return JSON.parse(raw) as Record<string, QueueBooking>
  } catch {
    localStorage.removeItem(QUEUE_BOOKINGS_KEY)
    return {}
  }
}
