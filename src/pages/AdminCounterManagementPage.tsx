import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Edit3, Eye, MinusCircle, Plus, Search, Ticket, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'
import { type AdminCounter, type CounterStatus } from '../services/mock/adminData'
import { useAuth } from '../context/useAuth'
import { adminApi } from '../services/api/adminApi'
import '../styles/counter-management.css'

const statuses: Array<'All statuses' | CounterStatus> = ['All statuses', 'Available', 'Busy', 'Inactive', 'Maintenance']

type CounterForm = { name: string; department: string; staffMember: string; status: CounterStatus }
type ActivityItem = { id: number; message: string; time: string; tone: 'blue' | 'green' | 'orange' | 'red' }

const emptyForm: CounterForm = { name: '', department: '', staffMember: '', status: 'Available' }

export function AdminCounterManagementPage() {
  const { token } = useAuth()
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [counters, setCounters] = useState<AdminCounter[]>([])
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('All departments')
  const [status, setStatus] = useState(statuses[0])
  const [notice, setNotice] = useState('Loading counters from the hospital API…')
  const [noticeTone, setNoticeTone] = useState<'info' | 'success' | 'error'>('info')
  const [modal, setModal] = useState<'add' | 'edit' | 'details' | null>(null)
  const [selectedCounter, setSelectedCounter] = useState<AdminCounter | null>(null)
  const [form, setForm] = useState<CounterForm>(emptyForm)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const showNotice = (message: string, tone: 'info' | 'success' | 'error' = 'success') => { setNotice(message); setNoticeTone(tone) }
  const refresh = useCallback(async () => { if (!token) return; try { const [counterPage, departmentPage] = await Promise.all([adminApi.counters(token, { page: 1, limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>, adminApi.departments(token, { page: 1, limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>]); setDepartments(departmentPage.items.map((d) => ({ id: String(d._id), name: String(d.name) }))); setCounters(counterPage.items.map((c) => { const state = String(c.status); return { recordId: String(c._id), id: String(c.counterNumber), name: String(c.name), department: (c.department as { name?: string })?.name ?? '', staffMember: 'Not assigned', currentToken: String(c.currentServingToken ?? '-'), status: state === 'busy' ? 'Busy' : state === 'inactive' ? 'Inactive' : state === 'maintenance' ? 'Maintenance' : 'Available', lastUpdated: c.updatedAt ? new Date(String(c.updatedAt)).toLocaleString() : '—' } })); setLoadError(''); setNotice('Counters and departments loaded from the backend.') } catch (e) { const message = e instanceof Error ? e.message : 'Counters could not be loaded.'; setLoadError(message); showNotice(message, 'error') } finally { setLoading(false) } }, [token])
  useEffect(() => { queueMicrotask(() => { void refresh() }) }, [refresh])

  const departmentOptions = ['All departments', ...departments.map((item) => item.name)]
  const filteredCounters = useMemo(() => counters.filter((counter) => `${counter.id} ${counter.name} ${counter.staffMember}`.toLowerCase().includes(query.toLowerCase()) && (department === 'All departments' || counter.department === department) && (status === 'All statuses' || counter.status === status)), [counters, department, query, status])
  const summary = { total: counters.length, available: counters.filter((counter) => counter.status === 'Available').length, busy: counters.filter((counter) => counter.status === 'Busy').length, inactive: counters.filter((counter) => counter.status === 'Inactive' || counter.status === 'Maintenance').length }

  const addActivity = (message: string, tone: ActivityItem['tone']) => setActivity((current) => [{ id: Date.now(), message, time: 'Just now', tone }, ...current].slice(0, 6))

  const openAdd = () => { setForm({ ...emptyForm, department: departments[0]?.name ?? '' }); setSelectedCounter(null); setModal('add') }
  const openEdit = (counter: AdminCounter) => { setSelectedCounter(counter); setForm({ name: counter.name, department: counter.department, staffMember: counter.staffMember, status: counter.status === 'Busy' ? 'Available' : counter.status }); setModal('edit') }
  const openDetails = (counter: AdminCounter) => { setSelectedCounter(counter); setModal('details') }

  const apiStatus = (status: CounterStatus) => status === 'Inactive' ? 'inactive' as const : status === 'Maintenance' ? 'maintenance' as const : 'active' as const
  const saveForm = async () => { if (!form.name.trim() || !form.department) { showNotice('Counter name and department are required.', 'error'); return } if (!token) return; const departmentId = departments.find((item) => item.name === form.department)?.id; if (!departmentId) { showNotice('Select an available department.', 'error'); return } try { if (modal === 'add') { const counterNumber = `CTR-${Date.now().toString(36).toUpperCase()}`; await adminApi.createCounter(token, { name: form.name.trim(), counterNumber, departmentId, status: apiStatus(form.status) }); addActivity(`${counterNumber} was created.`, 'green') } else { if (!selectedCounter?.recordId) return; await adminApi.updateCounter(token, selectedCounter.recordId, { name: form.name.trim(), departmentId }); if (form.status !== selectedCounter.status) await adminApi.setCounterStatus(token, selectedCounter.recordId, apiStatus(form.status)); addActivity(`${selectedCounter.id} details were updated.`, 'blue') } await refresh(); showNotice('Counter saved successfully.'); setModal(null) } catch (e) { showNotice(e instanceof Error ? e.message : 'Counter could not be saved.', 'error') } }

  const changeStatus = (counter: AdminCounter, nextStatus: CounterStatus) => {
    if (!token || !counter.recordId) return
    void adminApi.setCounterStatus(token, counter.recordId, apiStatus(nextStatus)).then(() => refresh()).then(() => { addActivity(`${counter.id} availability updated.`, 'green'); showNotice(`${counter.id} status changed.`) }).catch((e: unknown) => showNotice(e instanceof Error ? e.message : 'Counter status could not be changed.', 'error'))
  }

  const removeCounter = async (counter: AdminCounter) => { if (!counter.recordId || !token || !window.confirm(`Delete ${counter.id}? Counters serving a token cannot be deleted.`)) return; try { await adminApi.deleteCounter(token, counter.recordId); await refresh(); showNotice(`${counter.id} was deleted.`) } catch (e) { showNotice(e instanceof Error ? e.message : 'Counter could not be deleted.', 'error') } }

  return <AdminDashboardLayout>
    <motion.div className="counter-management-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
      <header className="counter-management-header"><div><div className="admin-breadcrumb"><Link to="/admin/dashboard">Admin Dashboard</Link><ChevronRight size={14} /><span>Counter Management</span></div><p className="admin-kicker">SERVICE OPERATIONS</p><h1>Counter Management</h1><p>Manage service counters, departments and availability.</p></div><button className="admin-action-button admin-action-button--primary" type="button" onClick={openAdd}><Plus size={17} /> Add Counter</button></header>
      <div className={`counter-management-notice counter-management-notice--${noticeTone}`} role="status"><CheckCircle2 size={17} /><span>{notice}</span></div>
      <section className="counter-summary-grid" aria-label="Counter summary"><CounterSummary icon={<Activity size={19} />} label="Total Counters" value={summary.total} tone="blue" /><CounterSummary icon={<CheckCircle2 size={19} />} label="Available Counters" value={summary.available} tone="green" /><CounterSummary icon={<UserRound size={19} />} label="Busy Counters" value={summary.busy} tone="orange" /><CounterSummary icon={<MinusCircle size={19} />} label="Inactive Counters" value={summary.inactive} tone="purple" /></section>
      <section className="counter-management-panel"><div className="counter-panel-heading"><div><p className="admin-kicker">COUNTER DIRECTORY</p><h2>Service counters</h2><p>{'Counter names, departments and availability are loaded from MongoDB.'}</p></div><span className="counter-demo-label">{'Backend data'}</span></div><div className="counter-filters"><label className="counter-search"><Search size={16} /><span className="sr-only">Search counter or staff</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search counter number or name" /></label><select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}>{departmentOptions.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as typeof statuses[number])}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div>{loading && <p role="status">Loading counters…</p>}{loadError && <p role="alert">{loadError} <button type="button" onClick={() => void refresh()}>Retry</button></p>}<div className="counter-card-grid">{filteredCounters.map((counter) => <CounterCard key={counter.recordId ?? counter.id} counter={counter} onEdit={openEdit} onDetails={openDetails} onStatusChange={changeStatus} onDelete={removeCounter} />)}</div>{!loading && !loadError && filteredCounters.length === 0 && <div className="counter-empty">No counters match the selected filters. Add a counter to get started.</div>}</section>
      <section className="counter-activity-grid"><section className="counter-management-panel"><div className="counter-panel-heading"><div><p className="admin-kicker">COUNTER ACTIVITY</p><h2>Recent changes</h2><p>Recent counter operations recorded by the API.</p></div></div><ul className="counter-activity-list">{activity.map((entry) => <li key={entry.id}><span className={`counter-activity-dot counter-activity-dot--${entry.tone}`} /><span><strong>{entry.message}</strong><small>{entry.time}</small></span></li>)}</ul>{activity.length === 0 && <p>No counter changes in this session.</p>}</section><section className="counter-management-panel"><div className="counter-panel-heading"><div><p className="admin-kicker">COUNTER RULES</p><h2>Availability</h2></div></div><div className="counter-rules"><p><Ticket size={16} /> Counters assigned to a serving token cannot be deleted.</p><p><CheckCircle2 size={16} /> Complete or skip a token to release its counter.</p><p><AlertTriangle size={16} /> Backend restrictions are shown when a change is rejected.</p></div></section></section>
      <p className="counter-management-footnote"><AlertTriangle size={15} /> {'Counter changes persist in MongoDB. Staff assignment and manual token assignment are not available in the current API.'}</p>
    </motion.div>
    {modal === 'add' || modal === 'edit' ? <CounterFormModal mode={modal} form={form} departments={departments.map((item) => item.name)} onChange={setForm} onSave={saveForm} onClose={() => setModal(null)} /> : null}
    {modal === 'details' && selectedCounter ? <CounterDetails counter={selectedCounter} onClose={() => setModal(null)} /> : null}
  </AdminDashboardLayout>
}

function CounterCard({ counter, onEdit, onDetails, onStatusChange, onDelete }: { counter: AdminCounter; onEdit: (counter: AdminCounter) => void; onDetails: (counter: AdminCounter) => void; onStatusChange: (counter: AdminCounter, status: CounterStatus) => void; onDelete: (counter: AdminCounter) => void }) {
  return <article className="counter-management-card"><div className="counter-card-heading"><div><span className="counter-id-label">{counter.id}</span><h3>{counter.name}</h3></div><span className={`counter-state counter-state--${counter.status.toLowerCase()}`}><span />{counter.status}</span></div><dl className="counter-info-list"><div><dt>Department</dt><dd>{counter.department}</dd></div><div><dt>Assigned staff</dt><dd>Not available</dd></div><div><dt>Current token</dt><dd>{counter.currentToken === '-' ? 'No token assigned' : counter.currentToken}</dd></div><div><dt>Last updated</dt><dd>{counter.lastUpdated}</dd></div></dl><div className="counter-card-actions"><button type="button" onClick={() => onDetails(counter)}><Eye size={15} /> Details</button><button type="button" onClick={() => onEdit(counter)}><Edit3 size={15} /> Edit</button><label>Status<select aria-label={`Change status for ${counter.id}`} value={counter.status} disabled={counter.status === 'Busy'} onChange={(event) => onStatusChange(counter, event.target.value as CounterStatus)}><option value="Available">Active</option><option value="Inactive">Inactive</option><option value="Maintenance">Maintenance</option></select></label><button type="button" onClick={() => onDelete(counter)}><X size={15} /> Delete</button></div></article>
}

function CounterSummary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) { return <article className="counter-summary-card"><span className={`counter-summary-icon counter-summary-icon--${tone}`}>{icon}</span><p>{label}</p><strong>{value}</strong></article> }

function CounterFormModal({ mode, form, departments, onChange, onSave, onClose }: { mode: 'add' | 'edit'; form: CounterForm; departments: string[]; onChange: (form: CounterForm) => void; onSave: () => void; onClose: () => void }) {
  return <Modal title={mode === 'add' ? 'Add counter' : 'Edit counter'} eyebrow={mode === 'add' ? 'NEW COUNTER' : 'COUNTER SETTINGS'} onClose={onClose}><div className="counter-form"><label>Counter name<input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="e.g. Registration Desk" /></label><label>Department<select required value={form.department} onChange={(event) => onChange({ ...form, department: event.target.value })}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><p className="modal-description">A unique counter number is generated when you create the counter. Staff assignment is not available in the current API.</p><label>Availability<select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as CounterStatus })}><option value="Available">Active</option><option value="Inactive">Inactive</option><option value="Maintenance">Maintenance</option></select></label></div><div className="counter-modal-actions"><button className="admin-action-button admin-action-button--secondary" type="button" onClick={onClose}>Cancel</button><button className="admin-action-button admin-action-button--primary" type="button" onClick={onSave}>{mode === 'add' ? 'Create counter' : 'Save changes'}</button></div></Modal>
}

function CounterDetails({ counter, onClose }: { counter: AdminCounter; onClose: () => void }) { return <Modal title={counter.id} eyebrow="COUNTER DETAILS" onClose={onClose}><div className="counter-detail-hero"><span className="counter-detail-icon"><Activity size={22} /></span><div><strong>{counter.name}</strong><span>{counter.department}</span></div></div><div className="counter-detail-grid"><Detail label="Assigned staff" value={counter.staffMember} /><Detail label="Current token" value={counter.currentToken === '-' ? 'No token assigned' : counter.currentToken} /><Detail label="Status" value={counter.status} /><Detail label="Last updated" value={counter.lastUpdated} /></div><button className="admin-action-button admin-action-button--secondary" type="button" onClick={onClose}>Close details</button></Modal> }

function Modal({ eyebrow, title, children, onClose }: { eyebrow: string; title: string; children: React.ReactNode; onClose: () => void }) { return <div className="counter-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="counter-modal" role="dialog" aria-modal="true" aria-labelledby="counter-modal-title"><div className="counter-modal-heading"><div><p className="admin-kicker">{eyebrow}</p><h2 id="counter-modal-title">{title}</h2></div><button type="button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>{children}</section></div> }
function Detail({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div> }
