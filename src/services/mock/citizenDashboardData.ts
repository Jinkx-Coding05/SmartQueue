import { getAppointments } from './appointmentService'
import { formatBookingDate } from './bookingData'
import { getQueueBooking, getSavedQueueBookings, type QueueBooking } from './queueData'

export const citizenDashboardData = {
  activeToken: 'A-024',
  peopleAhead: 5,
  estimatedWait: '18 minutes',
  appointmentSummary: '25 Nov, 10:30 AM',
  queue: {
    token: 'A-024',
    department: 'General Medicine',
    center: 'City General Hospital',
    counter: 'Counter 02',
    serving: 'A-019',
    peopleAhead: 5,
    estimatedWait: '18 minutes',
    progress: 42,
  },
  appointments: [
    { department: 'General Medicine', date: '25 Nov 2026', time: '10:30 AM', center: 'City General Hospital', status: 'Confirmed' },
    { department: 'Document Verification', date: '02 Dec 2026', time: '02:00 PM', center: 'Civic Services Center', status: 'Upcoming' },
  ],
  activities: [
    { title: 'Token booked successfully', detail: 'General Medicine · A-024', time: 'Today, 9:42 AM', tone: 'blue' },
    { title: 'Appointment confirmed', detail: '25 Nov 2026 · 10:30 AM', time: 'Yesterday', tone: 'green' },
    { title: 'Document checklist updated', detail: '3 of 4 documents ready', time: '20 Nov 2026', tone: 'orange' },
  ],
} as const

export function getCitizenDashboardSnapshot() {
  const mostRecentActiveBooking = getSavedQueueBookings()
    .filter((booking) => booking.stage !== 'completed' && booking.stage !== 'cancelled' && booking.stage !== 'skipped')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const fallbackBooking = getQueueBooking(citizenDashboardData.queue.token)
  const activeBooking = mostRecentActiveBooking ?? (fallbackBooking && !isTerminal(fallbackBooking.stage) ? fallbackBooking : null)
  const appointments = getAppointments()
    .filter((appointment) => appointment.status === 'upcoming')
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 2)
    .map((appointment) => ({
      department: appointment.department,
      date: formatBookingDate(appointment.date),
      time: appointment.time,
      center: appointment.center.name,
      status: 'Upcoming',
    }))

  return {
    ...citizenDashboardData,
    activeToken: activeBooking?.token ?? '—',
    peopleAhead: activeBooking?.peopleAhead ?? 0,
    estimatedWait: activeBooking ? `${activeBooking.estimatedWait} minutes` : '—',
    appointmentSummary: appointments[0] ? `${appointments[0].date}, ${appointments[0].time}` : 'No upcoming visit',
    queue: activeBooking ? dashboardQueue(activeBooking) : null,
    appointments,
    activities: mostRecentActiveBooking
      ? [{ title: 'Token booked successfully', detail: `${mostRecentActiveBooking.department} · ${mostRecentActiveBooking.token}`, time: 'This demo session', tone: 'blue' as const }, ...citizenDashboardData.activities.slice(1)]
      : citizenDashboardData.activities,
  }
}

function isTerminal(stage: QueueBooking['stage']) {
  return stage === 'completed' || stage === 'cancelled' || stage === 'skipped'
}

function dashboardQueue(booking: QueueBooking) {
  const initialAhead = booking.visitType === 'Emergency' ? 2 : 5
  const completedPeople = Math.max(0, initialAhead - booking.peopleAhead)
  return {
    token: booking.token,
    department: booking.department,
    center: booking.center.name,
    counter: booking.counter,
    serving: booking.currentServing,
    peopleAhead: booking.peopleAhead,
    estimatedWait: `${booking.estimatedWait} minutes`,
    progress: booking.stage === 'your-turn' || booking.stage === 'completed' ? 100 : Math.min(99, Math.round(completedPeople / initialAhead * 100)),
  }
}
