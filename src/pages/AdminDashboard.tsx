import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Bell, Check, CheckCircle2, Clock3, MoreHorizontal, PhoneCall, Search, Users, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'
import type { AdminAppointment, AdminCounter, AdminQueueItem, CounterStatus } from '../services/mock/adminData'
import { useAuth } from '../context/useAuth'
import { adminApi } from '../services/api/adminApi'

const departments = ['All departments', 'General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Dermatology']
const statuses = ['All statuses', 'Waiting', 'Serving', 'Called', 'Completed', 'Skipped']
const counterStatuses: CounterStatus[] = ['Available', 'Busy', 'Inactive']

export function AdminDashboard() {
  const { token } = useAuth()
  const [queue, setQueue] = useState<AdminQueueItem[]>([])
  const [counters, setCounters] = useState<AdminCounter[]>([])
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState(departments[0])
  const [status, setStatus] = useState(statuses[0])
  const [notice, setNotice] = useState('Loading live hospital data…')

  const load = useCallback(async () => { if (!token) return; try { const [dashboard, tokenPage, counterPage, appointmentPage] = await Promise.all([adminApi.dashboard(token) as Promise<Record<string, unknown>>, adminApi.tokens(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>, adminApi.counters(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>, adminApi.appointments(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>]); setMetrics(dashboard); setQueue(tokenPage.items.map((item) => ({ recordId: String(item._id), id: String(item.tokenNumber), patientName: (item.citizen as { fullName?: string })?.fullName ?? 'Citizen', department: (item.department as { name?: string })?.name ?? 'Department', priority: item.priority === 'emergency' ? 'Emergency' : item.priority === 'priority' ? 'Priority' : 'Normal', waitingMinutes: Number(item.estimatedWaitingTime ?? 0), counter: (item.counter as { counterNumber?: string })?.counterNumber ?? '—', status: ({ waiting: 'Waiting', serving: 'Serving', completed: 'Completed', skipped: 'Skipped', cancelled: 'Cancelled' } as Record<string, AdminQueueItem['status']>)[String(item.status)] ?? 'Waiting' }))); setCounters(counterPage.items.map((item) => ({ recordId: String(item._id), id: String(item.counterNumber), name: String(item.name), department: (item.department as { name?: string })?.name ?? '', staffMember: '', currentToken: String(item.currentServingToken ?? '—'), status: item.status === 'busy' ? 'Busy' : item.status === 'inactive' || item.status === 'maintenance' ? 'Inactive' : 'Available', lastUpdated: 'Live' }))); setAppointments(appointmentPage.items.map((item) => ({ recordId: String(item._id), appointmentId: String(item.appointmentId), patientName: (item.citizen as { fullName?: string })?.fullName ?? 'Citizen', doctorName: '', department: (item.department as { name?: string })?.name ?? 'Department', date: String(item.appointmentDate).slice(0, 10), time: String(item.appointmentTime), status: item.status === 'completed' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : item.status === 'approved' ? 'confirmed' : 'upcoming' }))); setNotice('Live figures loaded from the backend.') } catch (e) { setNotice(e instanceof Error ? e.message : 'Admin dashboard could not load. Retry the request.') } finally { setLoading(false) } }, [token])
  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  const filteredQueue = useMemo(() => queue.filter((item) => {
    const matchesQuery = `${item.id} ${item.patientName}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (department === departments[0] || item.department === department) && (status === statuses[0] || item.status === status)
  }), [department, query, queue, status])

  const updateNotice = (message: string) => setNotice(message)

  const callNextPatient = () => {
    const next = queue.find((item) => item.status === 'Waiting')
    const department = (metrics?.departmentQueues as Array<{ department: { _id?: string; id?: string; name: string }; waiting: number }> | undefined)?.find((item) => item.department.name === next?.department)
    const departmentId = department?.department._id ?? department?.department.id
    if (!token || !next || !departmentId) { updateNotice('No eligible waiting token and department were found.'); return }
    void adminApi.callNext(token, departmentId).then(() => load()).then(() => updateNotice(`${next.id} was called to the next available counter.`)).catch((e: unknown) => updateNotice(e instanceof Error ? e.message : 'Could not call next token.'))
  }

  const completePatient = (item: AdminQueueItem) => {
    if (!window.confirm(`Mark ${item.id} for ${item.patientName} as completed?`)) return
    if (!token || !item.recordId) return
    void adminApi.completeToken(token, item.recordId).then(() => load()).then(() => updateNotice(`${item.id} was marked completed.`)).catch((e: unknown) => updateNotice(e instanceof Error ? e.message : 'Token could not be completed.'))
  }

  const toggleEmergency = (item: AdminQueueItem) => {
    void item
    updateNotice('Priority changes are not supported by the current admin API.')
  }

  const assignCounter = (item: AdminQueueItem, counter: string) => {
    void item; void counter
    updateNotice('Counters are assigned when a token is called; manual reassignment is not supported by the current API.')
  }

  const changeCounterStatus = (id: string, nextStatus: CounterStatus) => {
    const counter = counters.find((item) => item.id === id)
    if (!token || !counter?.recordId || nextStatus === 'Busy') { updateNotice('Busy status is controlled by active token assignments.'); return }
    void adminApi.setCounterStatus(token, counter.recordId, nextStatus === 'Inactive' ? 'inactive' : 'available').then(() => load()).then(() => updateNotice(`${id} is now ${nextStatus}.`)).catch((e: unknown) => updateNotice(e instanceof Error ? e.message : 'Counter status update failed.'))
  }

  const appointmentAction = (appointment: AdminAppointment, action: 'confirm' | 'cancel') => {
    if (action === 'cancel' && !window.confirm(`Cancel ${appointment.appointmentId}?`)) return
    if (!token || !appointment.recordId) return
    const operation = action === 'confirm' ? adminApi.approveAppointment(token, appointment.recordId) : adminApi.cancelAppointment(token, appointment.recordId)
    void operation.then(() => load()).then(() => updateNotice(`${appointment.appointmentId} was ${action === 'confirm' ? 'approved' : 'cancelled'}.`)).catch((e: unknown) => updateNotice(e instanceof Error ? e.message : 'Appointment action failed.'))
  }

  const tokensByStatus = metrics?.tokensByStatus as Record<string, number> | undefined
  const departmentQueues = (metrics?.departmentQueues as Array<{ department: { name: string }; waiting: number; serving: number; estimatedWaitMinutes: number }> | undefined) ?? []
  const recentActivity = (metrics?.recentActivity as Array<{ action: string; description: string; createdAt: string }> | undefined) ?? []
  const totalToday = Number(metrics?.totalTokensToday ?? 0)
  const volumeData = [{ day: String(metrics?.date ?? 'Today'), patients: totalToday }]
  const departmentData = departmentQueues.map((item) => ({ department: item.department.name, patients: item.waiting + item.serving }))
  const waitingData = departmentQueues.map((item) => ({ day: item.department.name, minutes: item.estimatedWaitMinutes }))

  return <AdminDashboardLayout>
    <motion.div className="admin-dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
      <section className="admin-welcome"><div><p className="admin-kicker">OVERVIEW</p><h1>Queue command center</h1><p>{'Live service activity from the hospital database.'}</p></div><button className="admin-action-button admin-action-button--primary" type="button" onClick={callNextPatient} disabled={loading || !queue.some((item) => item.status === 'Waiting')}><PhoneCall size={17} /> Call Next Patient</button></section>
      <div className="admin-demo-notice" role="status"><Bell size={17} /> <span>{notice}</span></div>
      {loading && <p role="status">Loading dashboard…</p>}
      <section className="admin-stats-grid" aria-label="Hospital statistics">
        <AdminStat icon={<Users size={19} />} label="Tokens Today" value={String(totalToday)} helper="Database records" tone="blue" />
        <AdminStat icon={<Clock3 size={19} />} label="Active Tokens" value={String((tokensByStatus?.waiting ?? 0) + (tokensByStatus?.serving ?? 0))} helper="Waiting and serving" tone="green" />
        <AdminStat icon={<AlertTriangle size={19} />} label="Average Waiting Estimate" value={`${Number(metrics?.estimatedWaitMinutes ?? 0)} min`} helper="Stored estimate" tone="orange" />
        <AdminStat icon={<CheckCircle2 size={19} />} label="Completed Today" value={String(tokensByStatus?.completed ?? 0)} helper="Database records" tone="purple" />
      </section>

      <section className="admin-section"><div className="admin-section-heading"><div><p className="admin-kicker">LIVE QUEUE</p><h2>Queue overview</h2><p>Token and queue records from the hospital database.</p></div><span className="admin-live-status"><span /> Backend data</span></div>
        <div className="queue-controls"><label className="admin-control-search"><Search size={16} /><span className="sr-only">Search token or patient</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search token or patient" /></label><select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}>{departments.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="admin-queue-table-wrap"><table className="admin-queue-table"><thead><tr><th>Token</th><th>Patient</th><th>Department</th><th>Priority</th><th>Waiting</th><th>Counter</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredQueue.map((item) => <tr key={item.id}><th scope="row"><span className="token-id">{item.id}</span></th><td>{item.patientName}</td><td>{item.department}</td><td><button type="button" className={`priority-button priority-button--${item.priority.toLowerCase()}`} onClick={() => toggleEmergency(item)} title="Toggle emergency priority"><span />{item.priority}</button></td><td>{item.waitingMinutes} min</td><td><select aria-label={`Assign counter for ${item.id}`} value={item.counter} onChange={(event) => assignCounter(item, event.target.value)}>{counters.map((counter) => <option key={counter.id}>{counter.id}</option>)}</select></td><td><span className={`queue-status queue-status--${item.status.toLowerCase()}`}>{item.status}</span></td><td><div className="table-actions">{item.status !== 'Completed' && <button type="button" aria-label={`Complete ${item.id}`} onClick={() => completePatient(item)} title="Mark consultation completed"><Check size={16} /></button>}<button type="button" aria-label={`Toggle emergency for ${item.id}`} onClick={() => toggleEmergency(item)} title="Toggle emergency priority"><AlertTriangle size={15} /></button><button type="button" aria-label={`More actions for ${item.id}`} onClick={() => updateNotice(`Select a counter or priority action for ${item.id}.`)} title="View actions"><MoreHorizontal size={16} /></button></div></td></tr>)}</tbody></table>{filteredQueue.length === 0 && <div className="admin-empty-state">No queue records match these filters.</div>}</div>
      </section>

      <section className="admin-section"><div className="admin-section-heading"><div><p className="admin-kicker">COUNTERS</p><h2>Counter overview</h2><p>Availability from current counter records.</p></div></div><div className="counter-grid">{counters.map((counter) => <article className="counter-card" key={counter.id}><div className="counter-card__top"><span className="counter-number">{counter.id}</span><span className={`counter-status counter-status--${counter.status.toLowerCase()}`}><span />{counter.status}</span></div><h3>{counter.department}</h3><p>Current token <strong>{counter.currentToken}</strong></p><select aria-label={`Change status for ${counter.id}`} value={counter.status} onChange={(event) => changeCounterStatus(counter.id, event.target.value as CounterStatus)}>{counterStatuses.map((item) => <option key={item} disabled={item === 'Busy'}>{item}</option>)}</select></article>)}</div>{!counters.length && <p>No counters configured yet.</p>}</section>

      <section className="admin-lower-grid"><section className="admin-section"><div className="admin-section-heading"><div><p className="admin-kicker">APPOINTMENTS</p><h2>Today&apos;s appointments</h2></div><ArrowRight size={18} /></div><div className="admin-appointments">{appointments.map((appointment) => <article className="admin-appointment" key={appointment.appointmentId}><div className="appointment-time"><strong>{appointment.time}</strong><small>{appointment.appointmentId}</small></div><div className="appointment-copy"><strong>{appointment.patientName}</strong><span>{appointment.department} · {appointment.doctorName}</span></div><span className={`queue-status queue-status--${appointment.status}`}>{appointment.status}</span><div className="appointment-actions">{appointment.status === 'upcoming' && <><button type="button" onClick={() => appointmentAction(appointment, 'confirm')}><Check size={15} /> Approve</button><button type="button" onClick={() => appointmentAction(appointment, 'cancel')}><XCircle size={15} /> Cancel</button></>}</div></article>)}{!appointments.length && <p>No appointment records found.</p>}</div></section><section className="admin-section admin-activity-panel"><div className="admin-section-heading"><div><p className="admin-kicker">ACTIVITY</p><h2>Recent activity</h2></div></div><ul className="admin-activity-list">{recentActivity.length ? recentActivity.map((item, index) => <li key={`${item.createdAt}-${index}`}><span className={`activity-dot activity-dot--${index % 2 ? 'blue' : 'green'}`} /><span><strong>{item.description}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></span></li>) : <li>No recent admin activity recorded.</li>}</ul></section></section>

      <section className="admin-section"><div className="admin-section-heading"><div><p className="admin-kicker">ANALYTICS</p><h2>Service performance</h2><p>Queue counts and stored waiting-time estimates by department.</p></div></div><div className="admin-charts-grid"><ChartCard title="Tokens today"><ResponsiveContainer width="100%" height="100%"><BarChart data={volumeData}><CartesianGrid strokeDasharray="3 3" stroke="#e5edf5" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="patients" fill="#2878d0" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Department queue distribution"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={departmentData} dataKey="patients" nameKey="department" cx="50%" cy="50%" outerRadius={82}>{departmentData.map((entry, index) => <Cell key={entry.department} fill={['#2878d0', '#153e75', '#16a477', '#f5a623', '#8568cc'][index % 5]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></ChartCard><ChartCard title="Waiting estimates by department"><ResponsiveContainer width="100%" height="100%"><LineChart data={waitingData}><CartesianGrid strokeDasharray="3 3" stroke="#e5edf5" /><XAxis dataKey="day" /><YAxis unit="m" /><Tooltip formatter={(value) => [`${value} minutes`, 'Stored estimate']} /><Line type="monotone" dataKey="minutes" stroke="#16a477" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></ChartCard></div></section>
    </motion.div>
  </AdminDashboardLayout>
}

function AdminStat({ icon, label, value, helper, tone }: { icon: React.ReactNode; label: string; value: string; helper: string; tone: string }) { return <article className="admin-stat-card"><span className={`admin-stat-icon admin-stat-icon--${tone}`}>{icon}</span><p>{label}</p><strong>{value}</strong><small>{helper}</small></article> }
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) { return <article className="admin-chart-card"><h3>{title}</h3><div className="admin-chart">{children}</div></article> }
