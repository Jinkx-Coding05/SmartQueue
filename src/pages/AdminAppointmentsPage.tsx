import { AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Eye, FilterX, Phone, Search, UserRound, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'
import { formatBookingDate } from '../services/mock/bookingData'
import type { AdminAppointmentRecord, AdminAppointmentStatus } from '../services/mock/adminAppointmentService'
import { useAuth } from '../context/useAuth'
import { adminApi } from '../services/api/adminApi'
import '../styles/admin-appointments.css'

const allDepartments = 'All Departments'
const statuses: { value: 'all' | AdminAppointmentStatus; label: string }[] = [{ value: 'all', label: 'All statuses' }, { value: 'pending', label: 'Pending approval' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]
const pageSize = 6

type Notice = { message: string; tone: 'info' | 'success' | 'error' }

export function AdminAppointmentsPage() {
  const { token } = useAuth()
  const [appointments, setAppointments] = useState<AdminAppointmentRecord[]>([])
  const [query, setQuery] = useState('')
  const [departments, setDepartments] = useState<string[]>([allDepartments])
  const [department, setDepartment] = useState(allDepartments)
  const [status, setStatus] = useState<'all' | AdminAppointmentStatus>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdminAppointmentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<Notice>({ message: 'Appointment records load from the backend.', tone: 'info' })

  const load = useCallback(async () => { if (!token) return; try { const [response, departmentPage] = await Promise.all([adminApi.appointments(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>, adminApi.departments(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>]); setDepartments([allDepartments, ...departmentPage.items.map((item) => String(item.name))]); setAppointments(response.items.map((item) => { const user = item.citizen as { fullName?: string; phoneNumber?: string } | undefined; const departmentData = item.department as { name?: string } | undefined; const date = new Date(String(item.appointmentDate)); const time = String(item.appointmentTime ?? '09:00'); const [hour, minute] = time.split(':').map(Number); const displayTime = new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); const rawStatus = String(item.status); return { recordId: String(item._id), appointmentId: String(item.appointmentId), patientName: user?.fullName ?? 'Citizen', contactNumber: user?.phoneNumber ?? 'Not provided', department: departmentData?.name ?? 'Department', doctorName: 'Assigned by hospital', date: date.toISOString().slice(0, 10), time: displayTime, priority: 'Normal', status: (rawStatus === 'approved' ? 'confirmed' : rawStatus === 'rescheduled' ? 'upcoming' : rawStatus) as AdminAppointmentStatus } as AdminAppointmentRecord })); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Appointments could not be loaded.') } finally { setLoading(false) } }, [token])
  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  const filteredAppointments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return appointments.filter((appointment) => (!normalizedQuery || `${appointment.appointmentId} ${appointment.patientName}`.toLowerCase().includes(normalizedQuery)) && (department === allDepartments || appointment.department === department) && (status === 'all' || appointment.status === status) && (!dateFilter || appointment.date === dateFilter)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  }, [appointments, dateFilter, department, query, status])

  const pageCount = Math.max(1, Math.ceil(filteredAppointments.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleAppointments = filteredAppointments.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const summary = {
    total: appointments.length,
    upcoming: appointments.filter((item) => item.status === 'upcoming' || item.status === 'confirmed').length,
    pending: appointments.filter((item) => item.status === 'pending').length,
    completed: appointments.filter((item) => item.status === 'completed').length,
    cancelled: appointments.filter((item) => item.status === 'cancelled').length,
  }

  const act = async (appointment: AdminAppointmentRecord, action: 'approve' | 'complete' | 'cancel' | 'reschedule', date?: string, time?: string) => { if (!token || !appointment.recordId) return; try { if (action === 'approve') await adminApi.approveAppointment(token, appointment.recordId); else if (action === 'complete') await adminApi.completeAppointment(token, appointment.recordId); else if (action === 'cancel') await adminApi.cancelAppointment(token, appointment.recordId); else { if (!/^\d{2}:\d{2}$/.test(time ?? '')) throw new Error('Choose a valid appointment time.'); await adminApi.rescheduleAppointment(token, appointment.recordId, { appointmentDate: date ?? '', appointmentTime: time! }) } await load(); setNotice({ message: `Appointment ${appointment.appointmentId} updated.`, tone: 'success' }) } catch (e) { setNotice({ message: e instanceof Error ? e.message : 'Appointment update failed.', tone: 'error' }) } }
  const approve = (appointment: AdminAppointmentRecord) => { void act(appointment, 'approve') }
  const complete = (appointment: AdminAppointmentRecord) => {
    if (!window.confirm(`Mark ${appointment.appointmentId} as completed?`)) return
    void act(appointment, 'complete')
  }
  const cancel = (appointment: AdminAppointmentRecord) => {
    if (!window.confirm(`Cancel ${appointment.appointmentId}?`)) return
    void act(appointment, 'cancel')
  }
  const reschedule = async (appointment: AdminAppointmentRecord, date: string, time: string) => { if (!token || !appointment.recordId) throw new Error('Admin session expired.'); if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('Choose a valid appointment time.'); await adminApi.rescheduleAppointment(token, appointment.recordId, { appointmentDate: date, appointmentTime: time }); await load(); setNotice({ message: `Appointment ${appointment.appointmentId} updated.`, tone: 'success' }) }
  const clearFilters = () => { setQuery(''); setDepartment(allDepartments); setStatus('all'); setDateFilter(''); setPage(1) }

  return <AdminDashboardLayout><motion.div className="admin-appointments-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
    <header className="admin-appointments-header"><div><div className="admin-breadcrumb"><Link to="/admin/dashboard">Admin Dashboard</Link><ChevronRight size={14} /><span>Appointments</span></div><p className="admin-kicker">VISIT OPERATIONS</p><h1>Appointments</h1><p>{'Review and update appointments stored by the hospital API.'}</p></div><span className="admin-appointment-demo-badge"><span /> {'Backend data'}</span></header>
    <div className={`admin-appointments-notice admin-appointments-notice--${notice.tone}`} role="status"><CheckCircle2 size={17} /><span>{notice.message}</span></div>
    <section className="admin-appointment-summary" aria-label="Appointment summary"><SummaryCard label="Total Appointments" value={summary.total} tone="blue" icon={<CalendarDays size={19} />} /><SummaryCard label="Upcoming" value={summary.upcoming} tone="green" icon={<Clock3 size={19} />} /><SummaryCard label="Pending Approval" value={summary.pending} tone="orange" icon={<AlertTriangle size={19} />} /><SummaryCard label="Completed" value={summary.completed} tone="purple" icon={<Check size={19} />} /><SummaryCard label="Cancelled" value={summary.cancelled} tone="red" icon={<X size={19} />} /></section>
    <section className="admin-appointments-panel"><div className="admin-appointments-panel-heading"><div><p className="admin-kicker">APPOINTMENT REGISTER</p><h2>Manage appointments</h2><p>Changes are saved to the hospital API.</p></div><span>{filteredAppointments.length} result{filteredAppointments.length === 1 ? '' : 's'}</span></div>
      <div className="admin-appointment-filters"><label className="admin-appointment-search"><Search size={16} /><span className="sr-only">Search appointment ID or patient</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search patient or appointment ID" /></label><select aria-label="Filter by department" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1) }}>{departments.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by appointment status" value={status} onChange={(event) => { setStatus(event.target.value as 'all' | AdminAppointmentStatus); setPage(1) }}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><label className="admin-date-filter"><CalendarDays size={15} /><span className="sr-only">Filter by appointment date</span><input type="date" aria-label="Filter by appointment date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }} /></label><button className="admin-clear-filters" type="button" onClick={clearFilters}><FilterX size={15} /> Clear filters</button></div>
      {loading && <div className="admin-appointment-state"><span className="admin-appointment-spinner" /> Loading appointments…</div>}
      {!loading && error && <div className="admin-appointment-state admin-appointment-state--error"><AlertTriangle size={18} /> {error}</div>}
      {!loading && !error && <><div className="admin-appointment-table-wrap"><table className="admin-appointment-table"><thead><tr><th>Appointment ID</th><th>Patient Name</th><th>Contact Number</th><th>Department</th><th>Appointment Date</th><th>Appointment Time</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleAppointments.map((appointment) => <AppointmentRow key={appointment.appointmentId} appointment={appointment} onView={setSelected} onApprove={approve} onComplete={complete} onCancel={cancel} />)}</tbody></table>{visibleAppointments.length === 0 && <div className="admin-appointment-state">No appointments match the selected filters.</div>}</div><Pagination page={currentPage} pageCount={pageCount} total={filteredAppointments.length} onChange={setPage} /></>}
    </section>
    <p className="admin-appointments-footnote"><AlertTriangle size={15} /> Patient contact and priority fields are not provided by the current admin appointment API.</p>
    {selected && <AppointmentDetails appointment={selected} onClose={() => setSelected(null)} onApprove={approve} onComplete={complete} onCancel={cancel} onReschedule={reschedule} />}
  </motion.div></AdminDashboardLayout>
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: ReactNode }) { return <article className="admin-appointment-summary-card"><span className={`admin-appointment-summary-icon admin-appointment-summary-icon--${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article> }

function AppointmentRow({ appointment, onView, onApprove, onComplete, onCancel }: { appointment: AdminAppointmentRecord; onView: (appointment: AdminAppointmentRecord) => void; onApprove: (appointment: AdminAppointmentRecord) => void; onComplete: (appointment: AdminAppointmentRecord) => void; onCancel: (appointment: AdminAppointmentRecord) => void }) { return <tr><th scope="row"><button className="admin-appointment-id" type="button" onClick={() => onView(appointment)}>{appointment.appointmentId}</button></th><td>{appointment.patientName}</td><td><span className="admin-contact"><Phone size={13} /> {appointment.contactNumber}</span></td><td>{appointment.department}</td><td>{formatBookingDate(appointment.date)}</td><td>{appointment.time}</td><td><span className={`admin-appointment-priority admin-appointment-priority--${appointment.priority.toLowerCase()}`}><span />{appointment.priority}</span></td><td><StatusBadge status={appointment.status} /></td><td><div className="admin-appointment-actions"><button type="button" aria-label={`View details for ${appointment.appointmentId}`} title="View details" onClick={() => onView(appointment)}><Eye size={15} /></button>{appointment.status === 'pending' && <button type="button" aria-label={`Approve ${appointment.appointmentId}`} title="Approve appointment" onClick={() => onApprove(appointment)}><Check size={15} /></button>}{(appointment.status === 'upcoming' || appointment.status === 'confirmed') && <button type="button" aria-label={`Complete ${appointment.appointmentId}`} title="Mark completed" onClick={() => onComplete(appointment)}><CheckCircle2 size={15} /></button>}{appointment.status !== 'completed' && appointment.status !== 'cancelled' && <button className="admin-appointment-danger" type="button" aria-label={`Cancel ${appointment.appointmentId}`} title="Cancel appointment" onClick={() => onCancel(appointment)}><XCircle size={15} /></button>}</div></td></tr> }

function StatusBadge({ status }: { status: AdminAppointmentStatus }) { const label = status === 'pending' ? 'Pending approval' : status[0].toUpperCase() + status.slice(1); return <span className={`admin-appointment-status admin-appointment-status--${status}`}><span />{label}</span> }

function AppointmentDetails({ appointment, onClose, onApprove, onComplete, onCancel, onReschedule }: { appointment: AdminAppointmentRecord; onClose: () => void; onApprove: (appointment: AdminAppointmentRecord) => void; onComplete: (appointment: AdminAppointmentRecord) => void; onCancel: (appointment: AdminAppointmentRecord) => void; onReschedule: (appointment: AdminAppointmentRecord, date: string, time: string) => Promise<void> }) {
  const [date, setDate] = useState(appointment.date)
  const [time, setTime] = useState(() => toInputTime(appointment.time))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const canReschedule = appointment.status === 'pending' || appointment.status === 'upcoming' || appointment.status === 'confirmed'
  const submit = async () => {
    if (!date || date < getAdminAppointmentMinDate()) { setError('Choose a date from tomorrow onward.'); return }
    if (!time) { setError('Choose a valid time.'); return }
    try { await onReschedule(appointment, date, time); setError(''); setSuccess('Appointment rescheduled.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Appointment could not be rescheduled.') }
  }
  return <div className="admin-appointment-modal-backdrop" role="presentation"><section className="admin-appointment-modal" role="dialog" aria-modal="true" aria-labelledby="admin-appointment-details-heading"><div className="admin-appointment-modal-heading"><div><p className="admin-kicker">APPOINTMENT DETAILS</p><h2 id="admin-appointment-details-heading">{appointment.patientName}</h2><span>{appointment.appointmentId}</span></div><button type="button" aria-label="Close appointment details" onClick={onClose}><X size={19} /></button></div><div className="admin-appointment-detail-grid"><Detail label="Contact number" value={appointment.contactNumber} icon={<Phone size={15} />} /><Detail label="Department" value={appointment.department} icon={<UserRound size={15} />} /><Detail label="Date" value={formatBookingDate(appointment.date)} icon={<CalendarDays size={15} />} /><Detail label="Time" value={appointment.time} icon={<Clock3 size={15} />} /><Detail label="Priority" value={appointment.priority} icon={<AlertTriangle size={15} />} /><Detail label="Status" value={appointment.status === 'pending' ? 'Pending approval' : appointment.status} icon={<CheckCircle2 size={15} />} /></div>{canReschedule && <div className="admin-reschedule-panel"><h3>Reschedule appointment</h3><p>The API validates the new date and time against department availability.</p><div className="admin-reschedule-fields"><label>New date<input type="date" min={getAdminAppointmentMinDate()} value={date} onChange={(event) => setDate(event.target.value)} /></label><label>New time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div>{error && <p className="admin-appointment-inline-error" role="alert">{error}</p>}{success && <p className="admin-appointment-inline-success" role="status">{success}</p>}<button className="admin-action-button admin-action-button--secondary" type="button" onClick={submit}>Save reschedule</button></div>}{!canReschedule && <p className="admin-appointment-readonly">This appointment is {appointment.status} and cannot be changed.</p>}<div className="admin-appointment-modal-actions">{appointment.status === 'pending' && <button className="admin-action-button admin-action-button--primary" type="button" onClick={() => onApprove(appointment)}><Check size={16} /> Approve</button>}{(appointment.status === 'upcoming' || appointment.status === 'confirmed') && <button className="admin-action-button admin-action-button--secondary" type="button" onClick={() => onComplete(appointment)}><CheckCircle2 size={16} /> Mark completed</button>}{appointment.status !== 'completed' && appointment.status !== 'cancelled' && <button className="admin-action-button admin-appointment-cancel-button" type="button" onClick={() => onCancel(appointment)}><XCircle size={16} /> Cancel appointment</button>}<button className="admin-action-button admin-action-button--secondary" type="button" onClick={onClose}>Close details</button></div></section></div>
}

function Detail({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <div><span>{icon}</span><small>{label}</small><strong>{value}</strong></div> }
function getAdminAppointmentMinDate() { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10) }
function toInputTime(value: string) { const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value); if (!match) return '09:00'; let hour = Number(match[1]) % 12; if (match[3].toUpperCase() === 'PM') hour += 12; return `${String(hour).padStart(2, '0')}:${match[2]}` }

function Pagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) { return <div className="admin-appointment-pagination"><span>{total === 0 ? 'No matching appointments' : `Showing page ${page} of ${pageCount}`}</span><div><button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</button><button type="button" disabled={page === pageCount} onClick={() => onChange(page + 1)}>Next</button></div></div> }
