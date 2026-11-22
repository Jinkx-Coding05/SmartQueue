import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, Hospital, MapPin, Search, Ticket, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { formatBookingDate } from '../services/mock/bookingData'

import { cancelAppointment as cancelAppointmentApi, createAppointment, getDepartments, getMyAppointments, updateAppointment } from '../services/api/citizenApi'
import { useAuth } from '../context/useAuth'
import type { CitizenAppointmentApi } from '../types/citizenApi'
import type { DepartmentApi } from '../types/citizenApi'
import type { Appointment, AppointmentStatus } from '../services/mock/appointmentService'
import '../styles/appointments.css'

type AppointmentTab = 'all' | AppointmentStatus

const tabs: { value: AppointmentTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const statusOrder: Record<AppointmentStatus, number> = { upcoming: 0, completed: 1, cancelled: 2 }

export function AppointmentsPage() {
  const { token } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [activeTab, setActiveTab] = useState<AppointmentTab>('all')
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState<DepartmentApi[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [newDepartment, setNewDepartment] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('10:00')
  const [creating, setCreating] = useState(false)
  const loadAppointments = useCallback(async () => { if (!token) return; try { const result = await getMyAppointments(token, { limit: 100 }); setAppointments(result.items.map(mapAppointment)); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load appointments.') } finally { setLoading(false) } }, [token])
  useEffect(() => { queueMicrotask(() => { void loadAppointments() }); void getDepartments().then((items) => setDepartments(items.filter((item) => item.available))).catch(() => setDepartments([])) }, [loadAppointments])
  const handleCreate = async (event: FormEvent) => { event.preventDefault(); if (!token || !newDepartment || !newDate) return; setCreating(true); try { const created = await createAppointment(token, { departmentId: newDepartment, appointmentDate: newDate, appointmentTime: newTime }); const mapped = mapAppointment(created); setAppointments((items) => [mapped, ...items]); setCreateOpen(false); setMessage('Appointment booked successfully.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not book appointment.') } finally { setCreating(false) } }

  const counts = useMemo(() => ({ total: appointments.length, upcoming: appointments.filter((item) => item.status === 'upcoming').length, completed: appointments.filter((item) => item.status === 'completed').length, cancelled: appointments.filter((item) => item.status === 'cancelled').length }), [appointments])
  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return appointments.filter((appointment) => {
      const matchesTab = activeTab === 'all' || appointment.status === activeTab
      const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter
      const matchesSearch = !query || [appointment.appointmentId, appointment.center.name, appointment.department].some((value) => value.toLowerCase().includes(query))
      return matchesTab && matchesStatus && matchesSearch
    }).sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  }, [activeTab, appointments, search, statusFilter])

  const updateSelection = (appointment: Appointment | null) => {
    setSelected(appointment)
    setCancelTarget(null)
  }

  const handleReschedule = async (id: string, date: string, time: string) => {
    if (!token) throw new Error('Your session expired.')
    const target = appointments.find((item) => item.appointmentId === id)
    const updated = mapAppointment(await updateAppointment(token, target?.id ?? id, { appointmentDate: date, appointmentTime: time }))
    setAppointments((current) => current.map((item) => item.appointmentId === id ? updated : item)); setSelected(updated); setMessage('Appointment rescheduled successfully.')
  }

  const handleCancel = () => {
    if (!cancelTarget) return
    if (!token) return
    void cancelAppointmentApi(token, cancelTarget.id ?? cancelTarget.appointmentId).then((result) => { const updated = mapAppointment(result); setAppointments((current) => current.map((item) => item.appointmentId === updated.appointmentId ? updated : item)); setSelected(updated); setCancelTarget(null); setMessage('Appointment cancelled.') }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not cancel appointment.'))
  }

  return <DashboardLayout><motion.div className="appointments-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
    <header className="appointments-page-header"><div><div className="appointments-breadcrumb"><Link to="/citizen/dashboard">Dashboard</Link><ChevronRight size={14} /><span>My Appointments</span></div><p className="dashboard-kicker">VISIT PLANNER</p><h1>My Appointments</h1><p>Manage and track your healthcare appointments.</p></div><button className="button button--primary" type="button" onClick={() => setCreateOpen((open) => !open)}><CalendarDays size={16} /> Book Appointment</button></header>
    {createOpen && <form className="appointments-create-form" onSubmit={handleCreate}><h2>Schedule an appointment</h2><label>Department<select required value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)}><option value="">Choose department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Date<input type="date" required min={getAppointmentMinDate()} value={newDate} onChange={(event) => setNewDate(event.target.value)} /></label><label>Time<input type="time" required value={newTime} onChange={(event) => setNewTime(event.target.value)} /></label><button className="button button--primary" type="submit" disabled={creating || !departments.length}>{creating ? 'Booking…' : 'Confirm appointment'}</button>{!departments.length && <p>No departments are currently available.</p>}</form>}
    {message && <div className="appointments-message" role="status"><CheckCircle2 size={17} /><span>{message}</span><button type="button" aria-label="Dismiss message" onClick={() => setMessage('')}><X size={15} /></button></div>}{error && <p role="alert" className="appointment-inline-error">{error} <button type="button" onClick={() => void loadAppointments()}>Retry</button></p>}
    <section className="appointment-summary-grid" aria-label="Appointment summary"><SummaryCard label="Total appointments" value={counts.total} tone="blue" icon={<CalendarDays size={19} />} /><SummaryCard label="Upcoming" value={counts.upcoming} tone="green" icon={<Clock3 size={19} />} /><SummaryCard label="Completed" value={counts.completed} tone="purple" icon={<Check size={19} />} /><SummaryCard label="Cancelled" value={counts.cancelled} tone="orange" icon={<X size={19} />} /></section>
    <section className="appointments-list-section"><div className="appointments-toolbar"><div className="appointment-tabs" role="tablist" aria-label="Appointment status"><span className="appointments-tabs-label">Show:</span>{tabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} className={activeTab === tab.value ? 'appointment-tab appointment-tab--active' : 'appointment-tab'} onClick={() => setActiveTab(tab.value)}>{tab.label}<span>{tab.value === 'all' ? counts.total : counts[tab.value]}</span></button>)}</div><div className="appointments-filters"><label className="appointment-search"><Search size={16} /><span className="sr-only">Search appointments</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hospital, department or ID" /></label><label className="appointment-status-filter"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AppointmentStatus | 'all')}><option value="all">All statuses</option><option value="upcoming">Upcoming</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><ChevronDown size={15} /></label></div></div><div className="appointments-list-heading"><div><p className="dashboard-kicker">YOUR VISITS</p><h2>Appointment history</h2></div><span>{filteredAppointments.length} result{filteredAppointments.length === 1 ? '' : 's'}</span></div>{loading ? <p role="status">Loading appointments…</p> : filteredAppointments.length ? <div className="appointment-cards">{filteredAppointments.map((appointment) => <AppointmentCard key={appointment.appointmentId} appointment={appointment} onView={() => updateSelection(appointment)} />)}</div> : <EmptyAppointments search={search} onReset={() => { setSearch(''); setActiveTab('all'); setStatusFilter('all') }} />}</section>
    <div className="appointments-bottom-actions"><Link className="button button--secondary" to="/citizen/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link><Link className="button button--primary" to="/citizen/book-token">Book New Token <ArrowRight size={16} /></Link></div>
    {selected && <AppointmentDetails appointment={selected} cancelTarget={cancelTarget} onClose={() => updateSelection(null)} onStartCancel={() => setCancelTarget(selected)} onCancelConfirm={handleCancel} onCancelDismiss={() => setCancelTarget(null)} onReschedule={handleReschedule} />}
  </motion.div></DashboardLayout>
}

function mapAppointment(item: CitizenAppointmentApi): Appointment { const center = { id: 'configured', name: 'Hospital', location: 'Configured service center', services: [] }; return { id: item.id, token: '', center, department: item.department.name, visitType: 'Appointment', date: item.appointmentDate.slice(0, 10), time: item.appointmentTime, estimatedWait: 0, peopleAhead: 0, currentServing: '', counter: '', stage: item.status === 'completed' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'waiting', createdAt: item.createdAt, appointmentId: item.appointmentId, doctorName: 'Not assigned', status: item.status === 'completed' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'upcoming' } }

function getAppointmentMinDate() { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10) }

function SummaryCard({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: ReactNode }) {
  return <article className="appointment-summary-card"><span className={`summary-card-icon summary-card-icon--${tone}`}>{icon}</span><span><small>{label}</small><strong>{value}</strong></span></article>
}

function AppointmentCard({ appointment, onView }: { appointment: Appointment; onView: () => void }) {
  return <article className="appointment-list-card"><div className="appointment-list-icon"><Hospital size={20} /></div><div className="appointment-list-main"><div className="appointment-list-title"><div><span className="appointment-id">{appointment.appointmentId}</span><h3>{appointment.department}</h3></div><StatusBadge status={appointment.status} /></div><div className="appointment-list-meta"><span><Hospital size={14} /> {appointment.center.name}</span><span><CalendarDays size={14} /> {formatBookingDate(appointment.date)}</span><span><Clock3 size={14} /> {appointment.time}</span><span><UserRound size={14} /> {appointment.doctorName}</span></div>{appointment.token && <span className="appointment-token"><Ticket size={13} /> Token {appointment.token}</span>}</div><button className="button button--secondary appointment-view-button" type="button" onClick={onView}>View Details <ArrowRight size={15} /></button></article>
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`appointment-status-badge appointment-status-badge--${status}`}><span /> {status[0].toUpperCase() + status.slice(1)}</span>
}

function AppointmentDetails({ appointment, cancelTarget, onClose, onStartCancel, onCancelConfirm, onCancelDismiss, onReschedule }: { appointment: Appointment; cancelTarget: Appointment | null; onClose: () => void; onStartCancel: () => void; onCancelConfirm: () => void; onCancelDismiss: () => void; onReschedule: (id: string, date: string, time: string) => Promise<void> }) {
  const [date, setDate] = useState(appointment.date)
  const [time, setTime] = useState(appointment.time)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const minDate = getAppointmentMinDate()

  const submitReschedule = async () => {
    if (!date || date < minDate) { setError('Choose a date from tomorrow onward.'); return }
    if (!time) { setError('Choose an available time slot.'); return }
    try { await onReschedule(appointment.appointmentId, date, time); setError(''); setSuccess('Appointment updated successfully.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Appointment could not be rescheduled.') }
  }

  return <div className="appointment-modal-backdrop" role="presentation"><section className="appointment-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-details-title"><div className="appointment-modal-header"><div><p className="dashboard-kicker">APPOINTMENT DETAILS</p><h2 id="appointment-details-title">{appointment.department}</h2><span>{appointment.appointmentId}</span></div><button className="modal-close-button" type="button" onClick={onClose} aria-label="Close appointment details"><X size={19} /></button></div><div className="modal-detail-grid"><Detail label="Service center" value={appointment.center.name} icon={<Hospital size={16} />} /><Detail label="Location" value={appointment.center.location} icon={<MapPin size={16} />} /><Detail label="Date" value={formatBookingDate(appointment.date)} icon={<CalendarDays size={16} />} /><Detail label="Time" value={appointment.time} icon={<Clock3 size={16} />} /><Detail label="Doctor" value={appointment.doctorName} icon={<UserRound size={16} />} /><Detail label="Token" value={appointment.token || 'Not assigned'} icon={<Ticket size={16} />} /></div><div className="modal-status-row"><span>Status</span><StatusBadge status={appointment.status} /></div>{appointment.status === 'upcoming' && <div className="reschedule-panel"><h3>Reschedule appointment</h3><p>Select a future date and time. The API checks department availability.</p><div className="reschedule-fields"><label>New date<input type="date" min={minDate} value={date} onChange={(event) => setDate(event.target.value)} /></label><label>New time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div>{error && <p className="appointment-inline-error" role="alert">{error}</p>}{success && <p className="appointment-inline-success" role="status"><CheckCircle2 size={15} /> {success}</p>}<div className="modal-actions"><button className="button button--secondary" type="button" onClick={submitReschedule}>Save reschedule</button><button className="button button--danger" type="button" onClick={onStartCancel}>Cancel Appointment</button></div></div>}{appointment.status !== 'upcoming' && <p className="modal-readonly-note">This appointment is {appointment.status} and cannot be rescheduled.</p>}{cancelTarget && <div className="cancel-confirmation" role="alertdialog" aria-label="Confirm appointment cancellation"><strong>Cancel this appointment?</strong><p>This cancels the appointment in the hospital API.</p><div><button className="button button--secondary" type="button" onClick={onCancelDismiss}>Keep Appointment</button><button className="button button--danger" type="button" onClick={onCancelConfirm}>Yes, Cancel</button></div></div>}</section></div>
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="modal-detail"><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>
}

function EmptyAppointments({ search, onReset }: { search: string; onReset: () => void }) {
  return <div className="appointments-empty"><CalendarDays size={25} /><h3>{search ? 'No appointments match your search' : 'No appointments in this view'}</h3><p>{search ? 'Try a different hospital, department or appointment ID.' : 'Book a token to see your upcoming visits here.'}</p><button className="button button--secondary" type="button" onClick={onReset}>Reset filters</button></div>
}
