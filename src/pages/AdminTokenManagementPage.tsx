import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronRight, Clock3, Eye, Flag, PhoneCall, Search, SkipForward, Ticket, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'
import { type AdminQueueItem } from '../services/mock/adminData'
import { useAuth } from '../context/useAuth'
import { adminApi } from '../services/api/adminApi'
import '../styles/token-management.css'

const allDepartments = 'All Departments'
const priorities = ['All priorities', 'Normal', 'Priority', 'Emergency']
const statuses = ['All statuses', 'Waiting', 'Serving', 'Completed', 'Skipped', 'Cancelled']
const pageSize = 6

type NoticeTone = 'info' | 'success' | 'error'
type TokenNotice = { message: string; tone: NoticeTone }

export function AdminTokenManagementPage() {
  const { token } = useAuth()
  const [queue, setQueue] = useState<AdminQueueItem[]>([])
  const [query, setQuery] = useState('')
  const [departments, setDepartments] = useState<string[]>([allDepartments])
  const [department, setDepartment] = useState(allDepartments)
  const [priority, setPriority] = useState(priorities[0])
  const [status, setStatus] = useState(statuses[0])
  const [page, setPage] = useState(1)
  const [selectedToken, setSelectedToken] = useState<AdminQueueItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<TokenNotice>({ message: 'Token records load from the backend.', tone: 'info' })

  const reload = useCallback(async () => { if (!token) return; try { const [t, d] = await Promise.all([adminApi.tokens(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>, adminApi.departments(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>]); setDepartments([allDepartments, ...d.items.map((item) => String(item.name))]); setQueue(t.items.map((v) => ({ recordId: String(v._id), id: String(v.tokenNumber), patientName: (v.citizen as { fullName?: string })?.fullName ?? 'Citizen', department: (v.department as { name?: string })?.name ?? 'Department', priority: v.priority === 'emergency' ? 'Emergency' : v.priority === 'priority' ? 'Priority' : 'Normal', waitingMinutes: Number(v.estimatedWaitingTime ?? 0), counter: (v.counter as { counterNumber?: string })?.counterNumber ?? '-', status: ({ waiting: 'Waiting', serving: 'Serving', completed: 'Completed', skipped: 'Skipped', cancelled: 'Cancelled' } as Record<string, AdminQueueItem['status']>)[String(v.status)] ?? 'Waiting', bookingTime: new Date(String(v.bookingDate)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }))); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Token records could not be loaded.') } finally { setLoading(false) } }, [token])
  useEffect(() => { queueMicrotask(() => { void reload() }) }, [reload])

  const filteredTokens = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return queue.filter((item) => (
      (!normalizedQuery || `${item.id} ${item.patientName}`.toLowerCase().includes(normalizedQuery))
      && (department === allDepartments || item.department === department)
      && (priority === priorities[0] || item.priority === priority)
      && (status === statuses[0] || item.status === status)
    )).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  }, [department, priority, query, queue, status])

  const pageCount = Math.max(1, Math.ceil(filteredTokens.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleTokens = filteredTokens.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const summary = {
    total: queue.length,
    waiting: queue.filter((item) => item.status === 'Waiting').length,
    serving: queue.filter((item) => item.status === 'Serving' || item.status === 'Called').length,
    completed: queue.filter((item) => item.status === 'Completed').length,
    cancelled: queue.filter((item) => item.status === 'Cancelled').length,
  }

  const showNotice = (message: string, tone: NoticeTone = 'success') => setNotice({ message, tone })

  const runAction = async (item: AdminQueueItem, action: 'call' | 'complete' | 'skip' | 'cancel') => { if (!token || !item.recordId) return; try { if (action === 'call') await adminApi.callToken(token, item.recordId); else if (action === 'complete') await adminApi.completeToken(token, item.recordId); else if (action === 'skip') await adminApi.skipToken(token, item.recordId); else await adminApi.cancelToken(token, item.recordId); await reload(); showNotice(`Token ${item.id} updated.`) } catch (e) { showNotice(e instanceof Error ? e.message : 'Token update failed.', 'error') } }
  const callNextToken = () => { const next = queue.find((item) => item.status === 'Waiting'); if (next) void runAction(next, 'call'); else showNotice('There are no waiting tokens.', 'info') }

  const completeToken = (item: AdminQueueItem) => {
    if (item.status !== 'Serving' && item.status !== 'Called') {
      showNotice(`${item.id} is not currently serving.`, 'error')
      return
    }
    if (!window.confirm(`Mark ${item.id} as completed?`)) return
    void runAction(item, 'complete')
  }

  const skipToken = (item: AdminQueueItem) => {
    if (item.status !== 'Waiting' && item.status !== 'Serving' && item.status !== 'Called') {
      showNotice(`${item.id} cannot be skipped from its current state.`, 'error')
      return
    }
    if (!window.confirm(`Skip ${item.id}?`)) return
    void runAction(item, 'skip')
  }

  const cancelToken = (item: AdminQueueItem) => {
    if (item.status === 'Completed' || item.status === 'Cancelled') {
      showNotice(`${item.id} is already ${item.status.toLowerCase()}.`, 'error')
      return
    }
    if (!window.confirm(`Cancel ${item.id}?`)) return
    void runAction(item, 'cancel')
  }

  const markEmergency = (_item: AdminQueueItem) => showNotice('Priority changes are not available in the current backend API.', 'info')

  return <AdminDashboardLayout>
    <motion.div className="token-management-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
      <header className="token-management-header"><div><div className="admin-breadcrumb"><Link to="/admin/dashboard">Admin Dashboard</Link><ChevronRight size={14} /><span>Token Management</span></div><p className="admin-kicker">TOKEN OPERATIONS</p><h1>Token Management</h1><p>Review, prioritize and update today&apos;s service tokens.</p></div><button className="admin-action-button admin-action-button--primary" type="button" onClick={callNextToken}><PhoneCall size={17} /> Call Next Token</button></header>
      <div className={`token-management-notice token-management-notice--${notice.tone}`} role="status"><CheckCircle2 size={17} /><span>{notice.message}</span></div>
      <section className="token-summary-grid" aria-label="Token summary"><SummaryCard icon={<Ticket size={19} />} label="Total Tokens" value={summary.total} tone="blue" /><SummaryCard icon={<Clock3 size={19} />} label="Waiting" value={summary.waiting} tone="orange" /><SummaryCard icon={<PhoneCall size={19} />} label="Currently Serving" value={summary.serving} tone="green" /><SummaryCard icon={<Check size={19} />} label="Completed" value={summary.completed} tone="purple" /><SummaryCard icon={<X size={19} />} label="Cancelled" value={summary.cancelled} tone="red" /></section>
      <section className="token-management-panel"><div className="token-panel-heading"><div><p className="admin-kicker">TOKEN REGISTER</p><h2>Today&apos;s tokens</h2><p>Records and actions are managed by the hospital API.</p></div><span className="token-demo-badge"><span /> Backend data</span></div>
        <div className="token-filters"><label className="token-search"><Search size={16} /><span className="sr-only">Search token or patient</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search token number or patient name" /></label><select aria-label="Filter by department" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1) }}>{departments.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by priority" value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1) }}>{priorities.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div>
        {loading && <div className="token-state"><span className="token-spinner" /> Loading token records…</div>}
        {!loading && error && <div className="token-state token-state--error"><AlertTriangle size={18} />{error}</div>}
        {!loading && !error && <><div className="token-table-wrap"><table className="token-table"><thead><tr><th>Token Number</th><th>Patient Name</th><th>Department</th><th>Appointment Time</th><th>Priority</th><th>Status</th><th>Assigned Counter</th><th>Actions</th></tr></thead><tbody>{visibleTokens.map((item) => <TokenRow key={item.id} item={item} onDetails={setSelectedToken} onComplete={completeToken} onSkip={skipToken} onCancel={cancelToken} onCall={callNextToken} onEmergency={markEmergency} />)}</tbody></table>{visibleTokens.length === 0 && <div className="token-state">No tokens match the selected search or filters.</div>}</div><Pagination page={currentPage} pageCount={pageCount} total={filteredTokens.length} onChange={setPage} /></>}
      </section>
      <p className="token-management-footnote"><AlertTriangle size={15} /> Token changes are saved by the authenticated backend API.</p>
    </motion.div>
    {selectedToken && <TokenDetails item={selectedToken} onClose={() => setSelectedToken(null)} />}
  </AdminDashboardLayout>
}

function TokenRow({ item, onDetails, onComplete, onSkip, onCancel, onCall, onEmergency }: { item: AdminQueueItem; onDetails: (item: AdminQueueItem) => void; onComplete: (item: AdminQueueItem) => void; onSkip: (item: AdminQueueItem) => void; onCancel: (item: AdminQueueItem) => void; onCall: () => void; onEmergency: (item: AdminQueueItem) => void }) {
  return <tr><th scope="row"><button className="token-number-link" type="button" onClick={() => onDetails(item)}>{item.id}</button></th><td>{item.patientName}</td><td>{item.department}</td><td><span className="token-time"><CalendarClock size={14} />{item.bookingTime ?? 'Time unavailable'}</span></td><td><button className={`token-priority token-priority--${item.priority.toLowerCase()}`} type="button" onClick={() => onEmergency(item)}><span />{item.priority}</button></td><td><span className={`token-status token-status--${item.status.toLowerCase()}`}>{item.status}</span></td><td>{item.counter === '-' ? 'Unassigned' : item.counter}</td><td><div className="token-actions"><button type="button" aria-label={`View details for ${item.id}`} title="View details" onClick={() => onDetails(item)}><Eye size={15} /></button>{item.status === 'Waiting' && <button type="button" aria-label={`Call next token ${item.id}`} title="Call token" onClick={onCall}><PhoneCall size={15} /></button>}{(item.status === 'Serving' || item.status === 'Called') && <button type="button" aria-label={`Complete ${item.id}`} title="Mark completed" onClick={() => onComplete(item)}><Check size={15} /></button>}{item.status !== 'Completed' && item.status !== 'Cancelled' && <button type="button" aria-label={`Skip ${item.id}`} title="Skip token" onClick={() => onSkip(item)}><SkipForward size={15} /></button>}{item.status !== 'Completed' && item.status !== 'Cancelled' && <button className="token-action-danger" type="button" aria-label={`Cancel ${item.id}`} title="Cancel token" onClick={() => onCancel(item)}><X size={15} /></button>}{item.status === 'Waiting' && <button type="button" aria-label={`Toggle emergency priority for ${item.id}`} title="Toggle emergency priority" onClick={() => onEmergency(item)}><Flag size={15} /></button>}</div></td></tr>
}

function SummaryCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) { return <article className="token-summary-card"><span className={`token-summary-icon token-summary-icon--${tone}`}>{icon}</span><p>{label}</p><strong>{value}</strong></article> }

function Pagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) { return <div className="token-pagination"><span>{total === 0 ? 'No matching tokens' : `Showing page ${page} of ${pageCount}`}</span><div><button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</button><button type="button" disabled={page === pageCount} onClick={() => onChange(page + 1)}>Next</button></div></div> }

function TokenDetails({ item, onClose }: { item: AdminQueueItem; onClose: () => void }) { return <div className="token-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="token-details-modal" role="dialog" aria-modal="true" aria-labelledby="token-details-heading"><div className="token-modal-heading"><div><p className="admin-kicker">TOKEN DETAILS</p><h2 id="token-details-heading">{item.id}</h2></div><button type="button" aria-label="Close token details" onClick={onClose}><X size={19} /></button></div><div className="token-detail-grid"><Detail label="Patient name" value={item.patientName} /><Detail label="Department" value={item.department} /><Detail label="Visit type" value={item.visitType ?? 'New Consultation'} /><Detail label="Appointment time" value={item.bookingTime ?? 'Time unavailable'} /><Detail label="Priority" value={item.priority} /><Detail label="Status" value={item.status} /><Detail label="Assigned counter" value={item.counter === '-' ? 'Unassigned' : item.counter} /></div><button className="admin-action-button admin-action-button--secondary" type="button" onClick={onClose}>Close details</button></section></div> }
function Detail({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div> }
