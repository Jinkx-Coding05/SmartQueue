import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, Clock3, Eye, Flag, RotateCcw, Search, SkipForward, Ticket, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'
import type { AdminCounter, AdminQueueItem } from '../services/mock/adminData'
import { Link } from 'react-router-dom'
import '../styles/queue-management.css'
import { adminApi } from '../services/api/adminApi'
import { useAuth } from '../context/useAuth'

const allDepartments = 'All Departments'
const statuses = ['All statuses', 'Waiting', 'Serving', 'Completed', 'Skipped', 'Emergency']
const priorities = ['All priorities', 'Normal', 'Priority', 'Emergency']

type ActivityItem = { id: number; message: string; time: string; tone: 'blue' | 'green' | 'orange' | 'red' }

export function AdminQueueManagementPage() {
  const { token } = useAuth()
  const [queue, setQueue] = useState<AdminQueueItem[]>([])
  const [counters, setCounters] = useState<AdminCounter[]>([])
  const [departments, setDepartments] = useState<string[]>([allDepartments])
  const [department, setDepartment] = useState(allDepartments)
  const [status, setStatus] = useState(statuses[0])
  const [priority, setPriority] = useState(priorities[0])
  const [query, setQuery] = useState('')
  const [sortAscending, setSortAscending] = useState(true)
  const [selectedToken, setSelectedToken] = useState<AdminQueueItem | null>(null)
  const [notice, setNotice] = useState('Loading queue data…')
  const [noticeTone, setNoticeTone] = useState<'info' | 'success' | 'error'>('info')
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { if (!token) return; try { const [tokensPage, countersPage, activityPage, departmentPage] = await Promise.all([adminApi.tokens(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>, adminApi.counters(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>, adminApi.activity(token, { limit: 6 }) as Promise<{ items: Array<Record<string, unknown>> }>, adminApi.departments(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>]); setDepartments([allDepartments, ...departmentPage.items.map((item) => String(item.name))]); setQueue(tokensPage.items.map((t) => ({ recordId: String(t._id), id: String(t.tokenNumber), patientName: (t.citizen as { fullName?: string })?.fullName ?? 'Citizen', department: (t.department as { name?: string })?.name ?? 'Department', priority: t.priority === 'emergency' ? 'Emergency' : t.priority === 'priority' ? 'Priority' : 'Normal', waitingMinutes: Number(t.estimatedWaitingTime ?? 0), counter: (t.counter as { counterNumber?: string })?.counterNumber ?? '', status: ({ waiting: 'Waiting', serving: 'Serving', completed: 'Completed', skipped: 'Skipped', cancelled: 'Cancelled' } as Record<string, AdminQueueItem['status']>)[String(t.status)] ?? 'Waiting' }))); setCounters(countersPage.items.map((c) => ({ recordId: String(c._id), id: String(c.counterNumber), name: String(c.name), department: (c.department as { name?: string })?.name ?? '', staffMember: '', currentToken: String(c.currentServingToken ?? ''), status: c.status === 'busy' ? 'Busy' : c.status === 'inactive' || c.status === 'maintenance' ? 'Inactive' : 'Available', lastUpdated: 'Live' }))); setActivity(activityPage.items.map((a, i) => ({ id: i, message: String(a.description), time: new Date(String(a.createdAt)).toLocaleString(), tone: 'blue' }))); setNotice('Queue and counter data loaded from backend.') } catch (e) { setNotice(e instanceof Error ? e.message : 'Queue data could not be loaded.') } finally { setLoading(false) } }, [token])
  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  const showNotice = (message: string, tone: 'info' | 'success' | 'error' = 'success') => {
    setNotice(message)
    setNoticeTone(tone)
  }

  const filteredQueue = useMemo(() => queue.filter((item) => {
    const visibleStatus = item.status === 'Waiting' && item.priority === 'Emergency' ? 'Emergency' : item.status
    return `${item.id} ${item.patientName}`.toLowerCase().includes(query.toLowerCase())
      && (department === allDepartments || item.department === department)
      && (status === statuses[0] || visibleStatus === status)
      && (priority === priorities[0] || item.priority === priority)
  }).sort((a, b) => sortAscending ? a.waitingMinutes - b.waitingMinutes : b.waitingMinutes - a.waitingMinutes), [department, priority, query, queue, sortAscending, status])

  const summary = {
    total: queue.length,
    waiting: queue.filter((item) => item.status === 'Waiting').length,
    serving: queue.filter((item) => item.status === 'Serving' || item.status === 'Called').length,
    completed: queue.filter((item) => item.status === 'Completed').length,
  }

  const callNext = async () => {
    const next = queue.find((item) => item.status === 'Waiting' && item.recordId)
    if (!next || !token) { showNotice('There are no waiting tokens available to call.', 'info'); return }
    try { await adminApi.callToken(token, next.recordId!, counters.find((counter) => counter.department === next.department && counter.status === 'Available')?.recordId); await load(); showNotice(`Token ${next.id} was called.`) }
    catch (error) { showNotice(error instanceof Error ? error.message : 'Token could not be called.', 'error') }
  }

  const completeToken = (item: AdminQueueItem) => {
    if (item.status !== 'Serving' && item.status !== 'Called') { showNotice(`${item.id} is not currently serving.`, 'error'); return }
    if (!window.confirm(`Complete the consultation for ${item.id}?`)) return
    if (!token || !item.recordId) return
    void adminApi.completeToken(token, item.recordId).then(() => load()).then(() => showNotice(`Token ${item.id} was completed.`)).catch((error) => showNotice(error instanceof Error ? error.message : 'Token could not be completed.', 'error'))
  }

  const skipToken = (item: AdminQueueItem) => {
    if (item.status !== 'Waiting' && item.status !== 'Serving' && item.status !== 'Called') { showNotice(`${item.id} cannot be skipped from its current state.`, 'error'); return }
    if (!window.confirm(`Skip ${item.id}?`)) return
    if (!token || !item.recordId) return
    void adminApi.skipToken(token, item.recordId).then(() => load()).then(() => showNotice(`Token ${item.id} was skipped.`)).catch((error) => showNotice(error instanceof Error ? error.message : 'Token could not be skipped.', 'error'))
  }

  const recallToken = (_item: AdminQueueItem) => {
    showNotice('Recall is not available in the current backend API.', 'info')
  }

  const toggleEmergency = (_item: AdminQueueItem) => {
    showNotice('Priority changes are not available in the current backend API.', 'info')
  }

  const assignCounter = (item: AdminQueueItem, counterId: string) => {
    const counter = counters.find((entry) => entry.id === counterId)
    if (!counter || (counter.status !== 'Available' && counter.id !== item.counter)) { showNotice(`${counterId} is not available for assignment.`, 'error'); return }
    if (counter.department !== item.department) { showNotice(`${item.id} belongs to ${item.department}; choose a counter in that department.`, 'error'); return }
    showNotice('Manual counter assignment is not available in the current backend API.', 'info')
  }

  return <AdminDashboardLayout>
    <motion.div className="queue-management-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
      {loading && <p role="status">Loading backend queue data…</p>}
      <header className="queue-management-header"><div><div className="admin-breadcrumb"><Link to="/admin/dashboard">Admin Dashboard</Link><ChevronRight size={14} /><span>Queue Management</span></div><p className="admin-kicker">QUEUE OPERATIONS</p><h1>Queue Management</h1><p>Monitor and manage patient queues across departments.</p></div><button className="admin-action-button admin-action-button--primary" type="button" onClick={callNext}><SkipForward size={17} /> Call Next Patient</button></header>
      <div className={`queue-management-notice queue-management-notice--${noticeTone}`} role="status"><CheckCircle2 size={17} /><span>{notice}</span></div>
      <section className="queue-management-summary" aria-label="Queue summary"><SummaryCard icon={<Ticket size={19} />} label="Total Tokens" value={summary.total} tone="blue" /><SummaryCard icon={<Clock3 size={19} />} label="Waiting" value={summary.waiting} tone="orange" /><SummaryCard icon={<UserRound size={19} />} label="Currently Serving" value={summary.serving} tone="green" /><SummaryCard icon={<CheckCircle2 size={19} />} label="Completed" value={summary.completed} tone="purple" /></section>
      <section className="queue-management-panel"><div className="queue-management-panel-heading"><div><p className="admin-kicker">DEPARTMENT QUEUES</p><h2>Today&apos;s queue</h2><p>Emergency priority is considered before ordinary waiting tokens.</p></div><button className="sort-button" type="button" onClick={() => setSortAscending((current) => !current)}><Clock3 size={15} /> Waiting time {sortAscending ? '↑' : '↓'}</button></div>
        <div className="department-tabs" role="tablist" aria-label="Filter queue by department">{departments.map((item) => <button key={item} type="button" role="tab" aria-selected={department === item} className={department === item ? 'department-tab department-tab--active' : 'department-tab'} onClick={() => setDepartment(item)}>{item}</button>)}</div>
        <div className="queue-management-filters"><label className="queue-management-search"><Search size={16} /><span className="sr-only">Search token or patient</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search token ID or patient name" /></label><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value)}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="queue-management-table-wrap"><table className="queue-management-table"><thead><tr><th>Token ID</th><th>Patient Name</th><th>Department</th><th>Priority</th><th>Waiting Time</th><th>Counter</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredQueue.map((item) => <QueueRow key={item.id} item={item} counters={counters} onDetails={setSelectedToken} onComplete={completeToken} onSkip={skipToken} onRecall={recallToken} onEmergency={toggleEmergency} onAssign={assignCounter} />)}</tbody></table>{filteredQueue.length === 0 && <div className="queue-management-empty">No tokens match the selected filters.</div>}</div>
      </section>
      <section className="queue-activity-grid"><section className="queue-management-panel"><div className="queue-management-panel-heading"><div><p className="admin-kicker">ACTIVITY LOG</p><h2>Recent queue activity</h2><p>Recent operations recorded by the API.</p></div></div><ul className="queue-activity-list">{activity.map((entry) => <li key={entry.id}><span className={`queue-activity-dot queue-activity-dot--${entry.tone}`} /><span><strong>{entry.message}</strong><small>{entry.time}</small></span></li>)}</ul></section><section className="queue-management-panel queue-counter-panel"><div className="queue-management-panel-heading"><div><p className="admin-kicker">COUNTER AVAILABILITY</p><h2>Available counters</h2></div></div><div className="queue-counter-list">{counters.map((counter) => <div key={counter.id}><span><strong>{counter.id}</strong><small>{counter.department}</small></span><span className={`counter-status counter-status--${counter.status.toLowerCase()}`}><span />{counter.status}</span></div>)}</div></section></section>
      <p className="queue-management-footnote"><AlertTriangle size={15} /> Queue records and actions are loaded from the backend; the API enforces authentication and role access. Waiting times are estimates.</p>
    </motion.div>
    {selectedToken && <TokenDetails item={selectedToken} onClose={() => setSelectedToken(null)} />}
  </AdminDashboardLayout>
}

function QueueRow({ item, counters, onDetails, onComplete, onSkip, onRecall, onEmergency, onAssign }: { item: AdminQueueItem; counters: AdminCounter[]; onDetails: (item: AdminQueueItem) => void; onComplete: (item: AdminQueueItem) => void; onSkip: (item: AdminQueueItem) => void; onRecall: (item: AdminQueueItem) => void; onEmergency: (item: AdminQueueItem) => void; onAssign: (item: AdminQueueItem, counterId: string) => void }) {
  const displayStatus = item.status === 'Waiting' && item.priority === 'Emergency' ? 'Emergency' : item.status
  const assignmentOptions = counters.filter((counter) => counter.status === 'Available' || counter.id === item.counter)
  return <tr><th scope="row"><button className="queue-token-link" type="button" onClick={() => onDetails(item)}>{item.id}</button></th><td>{item.patientName}</td><td>{item.department}</td><td><button className={`queue-priority-button queue-priority-button--${item.priority.toLowerCase()}`} type="button" onClick={() => onEmergency(item)}><span />{item.priority}</button></td><td>{item.waitingMinutes} min</td><td><select aria-label={`Assign counter for ${item.id}`} value={item.counter} onChange={(event) => onAssign(item, event.target.value)}>{assignmentOptions.map((counter) => <option key={counter.id}>{counter.id}</option>)}</select></td><td><span className={`queue-status queue-status--${displayStatus.toLowerCase()}`}>{displayStatus}</span></td><td><div className="queue-row-actions"><button type="button" aria-label={`View details for ${item.id}`} title="View details" onClick={() => onDetails(item)}><Eye size={15} /></button>{(item.status === 'Serving' || item.status === 'Called') && <button type="button" aria-label={`Complete ${item.id}`} title="Complete consultation" onClick={() => onComplete(item)}><Check size={15} /></button>}{item.status === 'Skipped' ? <button type="button" aria-label={`Recall ${item.id}`} title="Recall token" onClick={() => onRecall(item)}><RotateCcw size={15} /></button> : item.status !== 'Completed' && <button type="button" aria-label={`Skip ${item.id}`} title="Skip token" onClick={() => onSkip(item)}><SkipForward size={15} /></button>}<button type="button" aria-label={`Emergency priority for ${item.id}`} title="Toggle emergency priority" onClick={() => onEmergency(item)}><Flag size={15} /></button></div></td></tr>
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) { return <article className="queue-summary-card"><span className={`queue-summary-icon queue-summary-icon--${tone}`}>{icon}</span><p>{label}</p><strong>{value}</strong></article> }

function TokenDetails({ item, onClose }: { item: AdminQueueItem; onClose: () => void }) {
  const status = item.status === 'Waiting' && item.priority === 'Emergency' ? 'Emergency' : item.status
  return <div className="queue-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="queue-details-modal" role="dialog" aria-modal="true" aria-labelledby="queue-details-heading"><div className="queue-details-modal-heading"><div><p className="admin-kicker">TOKEN DETAILS</p><h2 id="queue-details-heading">{item.id}</h2></div><button type="button" aria-label="Close token details" onClick={onClose}><X size={19} /></button></div><div className="queue-detail-grid"><Detail label="Patient name" value={item.patientName} /><Detail label="Department" value={item.department} /><Detail label="Visit type" value={item.visitType ?? 'New Consultation'} /><Detail label="Priority" value={item.priority} /><Detail label="Booking time" value={item.bookingTime ?? 'Time unavailable'} /><Detail label="Queue status" value={status} /><Detail label="Assigned counter" value={item.counter} /></div><button className="admin-action-button admin-action-button--secondary queue-modal-close" type="button" onClick={onClose}><ArrowLeft size={16} /> Close details</button></section></div>
}

function Detail({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div> }
