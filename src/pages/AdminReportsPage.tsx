import { Activity, BarChart3, Check, CheckCircle2, ChevronRight, Clock3, Download, LineChart as LineChartIcon, PieChart as PieChartIcon, RotateCcw, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'
import { getReportDateDefaults, type ReportRange, type ReportSnapshot } from '../services/mock/adminReportsService'
import { adminApi } from '../services/api/adminApi'
import { useAuth } from '../context/useAuth'
import '../styles/admin-reports.css'

const allDepartments = 'All Departments'
const chartColors = ['#2878d0', '#153e75', '#16a477', '#f5a623', '#8568cc']
const statusColors = ['#16a477', '#2878d0', '#dc5252', '#f5a623']

export function AdminReportsPage() {
  const { token } = useAuth()
  const defaults = useMemo(() => getReportDateDefaults(), [])
  const [range, setRange] = useState<ReportRange>('last7')
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([allDepartments])
  const [department, setDepartment] = useState(allDepartments)
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [reportState, setReportState] = useState<{ key: string; snapshot: ReportSnapshot | null; error: string } | null>(null)
  const currentFilterKey = `${range}|${department}|${startDate}|${endDate}`
  const currentReport = reportState?.key === currentFilterKey ? reportState : null
  const snapshot = currentReport?.snapshot ?? null
  const loading = currentReport === null
  const error = currentReport?.error ?? ''

  useEffect(() => {
    let active = true
    const load = async () => { try { if (range === 'custom' && (!startDate || !endDate || startDate > endDate)) throw new Error('Choose a valid custom date range.'); if (!token) throw new Error('Admin session expired.'); const today = new Date().toISOString().slice(0, 10); const from = range === 'today' ? today : range === 'custom' ? startDate : new Date(Date.now() - (range === 'last7' ? 6 : 29) * 86400000).toISOString().slice(0, 10); const to = range === 'custom' ? endDate : today; const deptPage = await adminApi.departments(token, { page: 1, limit: 100 }) as { items: Array<Record<string, unknown>> }; if (active) setDepartmentOptions([allDepartments, ...deptPage.items.map((item) => String(item.name))]); const selected = deptPage.items.find((item) => item.name === department); const data = await adminApi.reports(token, { from, to, ...(selected ? { departmentId: String(selected._id) } : {}) }) as Record<string, unknown>; if (active) setReportState({ key: currentFilterKey, snapshot: mapReport(data, from, to), error: '' }) } catch (caught) { if (active) setReportState({ key: currentFilterKey, snapshot: null, error: caught instanceof Error ? caught.message : 'Report data could not be loaded.' }) } }
    void load(); return () => { active = false }
  }, [currentFilterKey, department, endDate, range, startDate, token])

  const resetFilters = () => { setRange('last7'); setDepartment(allDepartments); setStartDate(defaults.startDate); setEndDate(defaults.endDate) }
  const exportCsv = () => { if (snapshot) downloadCsv(snapshot) }

  return <AdminDashboardLayout><motion.div className="admin-reports-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
    <header className="admin-reports-header"><div><div className="admin-breadcrumb"><Link to="/admin/dashboard">Admin Dashboard</Link><ChevronRight size={14} /><span>Reports</span></div><p className="admin-kicker">PERFORMANCE REPORTING</p><h1>Reports &amp; Analytics</h1><p>{'Reports aggregate saved queue and appointment records.'}</p></div><span className="admin-reports-demo-badge"><span /> {'Backend analytics'}</span></header>
    <div className="admin-reports-notice" role="status"><Activity size={17} /><span>{'Counts come from database records. Waiting-time values are stored estimates; actual service durations are not tracked.'}</span></div>
    <section className="admin-reports-toolbar" aria-label="Report filters"><div className="admin-report-filter-group"><label>Date range<select value={range} onChange={(event) => setRange(event.target.value as ReportRange)}><option value="today">Today</option><option value="last7">Last 7 Days</option><option value="last30">Last 30 Days</option><option value="custom">Custom</option></select></label><label>Department<select value={department} onChange={(event) => setDepartment(event.target.value)}>{departmentOptions.map((item) => <option key={item}>{item}</option>)}</select></label>{range === 'custom' && <><label>From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></>}</div><div className="admin-report-toolbar-actions"><button className="admin-report-reset" type="button" onClick={resetFilters}><RotateCcw size={15} /> Reset filters</button><button className="admin-action-button admin-action-button--primary" type="button" onClick={exportCsv} disabled={!snapshot || loading}><Download size={16} /> Export CSV</button></div></section>
    {loading && <div className="admin-report-state"><span className="admin-report-spinner" /> Preparing report data…</div>}
    {!loading && error && <div className="admin-report-state admin-report-state--error"><X size={18} /> {error}</div>}
    {!loading && !error && snapshot && <ReportContent snapshot={snapshot} />}
  </motion.div></AdminDashboardLayout>
}

function mapReport(data: Record<string, unknown>, dateStart: string, dateEnd: string): ReportSnapshot {
  const statuses = (data.tokensByStatus ?? []) as Array<{ _id: string; count: number; avgEstimatedWait?: number }>
  const departments = (data.departments ?? []) as Array<{ department: { name: string }; count: number; averageEstimatedWait: number }>
  const daily = (data.daily ?? []) as Array<{ _id: string; total: number }>
  const overview = (data.overview ?? {}) as { totalTokens?: number; completedTokens?: number; cancelledTokens?: number; averageEstimatedWaitMinutes?: number }
  const total = overview.totalTokens ?? statuses.reduce((sum, item) => sum + item.count, 0)
  const performance = departments.map((item) => ({ department: item.department.name, totalPatients: item.count, averageWaitingTime: Math.round(item.averageEstimatedWait ?? 0), averageServiceTime: 0, completedTokens: 0, pendingTokens: 0 }))
  return { dateStart, dateEnd, rangeLabel: `${dateStart} to ${dateEnd}`, summary: { totalPatients: total, completedTokens: overview.completedTokens ?? 0, averageWaitingTime: overview.averageEstimatedWaitMinutes ?? 0, averageServiceTime: 0, completionRate: Math.round(((overview.completedTokens ?? 0) / Math.max(total, 1)) * 100), cancelledTokens: overview.cancelledTokens ?? 0 }, dailyTraffic: daily.map((item) => ({ date: item._id, label: item._id.slice(5), patients: item.total })), departmentDistribution: performance.map((item) => ({ department: item.department, patients: item.totalPatients })), statusBreakdown: statuses.map((item) => ({ status: item._id, count: item.count })), waitingComparison: performance.map((item) => ({ department: item.department, waiting: item.averageWaitingTime, service: 0 })), hourlyTraffic: [], departmentPerformance: performance }
}

function ReportContent({ snapshot }: { snapshot: ReportSnapshot }) {
  return <><section className="admin-report-summary" aria-label="Report summary"><SummaryCard label="Total Tokens" value={snapshot.summary.totalPatients.toLocaleString()} detail={snapshot.rangeLabel} tone="blue" icon={<Users size={19} />} /><SummaryCard label="Completed Tokens" value={snapshot.summary.completedTokens.toLocaleString()} detail="From saved token records" tone="green" icon={<Check size={19} />} /><SummaryCard label="Average Waiting Estimate" value={`${snapshot.summary.averageWaitingTime} min`} detail="Stored estimate" tone="orange" icon={<Clock3 size={19} />} /><SummaryCard label="Average Service Time" value="Not tracked" detail="Not available in current schema" tone="purple" icon={<Activity size={19} />} /><SummaryCard label="Queue Completion Rate" value={`${snapshot.summary.completionRate}%`} detail="Completed / total tokens" tone="blue" icon={<CheckCircle2 size={19} />} /><SummaryCard label="Cancelled Tokens" value={snapshot.summary.cancelledTokens.toLocaleString()} detail="From saved token records" tone="red" icon={<X size={19} />} /></section>
    <section className="admin-report-chart-grid"><ChartPanel title="Daily patient traffic" description="Saved token counts over the selected period." icon={<LineChartIcon size={19} />}><div className="admin-report-chart" role="img" aria-label="Line chart showing daily token traffic"><ResponsiveContainer width="100%" height="100%"><LineChart data={snapshot.dailyTraffic} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5edf5" /><XAxis dataKey="label" tick={{ fill: '#65748a', fontSize: 11 }} /><YAxis tick={{ fill: '#65748a', fontSize: 11 }} /><Tooltip formatter={(value) => [`${value} patients`, 'Tokens']} /><Line type="monotone" dataKey="patients" name="Patients" stroke="#2878d0" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></ChartPanel><ChartPanel title="Department-wise distribution" description="Patient volume by selected department scope." icon={<PieChartIcon size={19} />}><div className="admin-report-chart" role="img" aria-label="Donut chart showing department-wise token counts"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={snapshot.departmentDistribution} dataKey="patients" nameKey="department" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2} labelLine={false} label={({ name, percent }) => `${String(name ?? '').split(' ')[0]} ${((percent ?? 0) * 100).toFixed(0)}%`}>{snapshot.departmentDistribution.map((entry, index) => <Cell key={entry.department} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => [`${value} patients`, 'Tokens']} /></PieChart></ResponsiveContainer></div></ChartPanel><ChartPanel title="Token status breakdown" description="Status mix for the selected reporting period." icon={<BarChart3 size={19} />}><div className="admin-report-chart" role="img" aria-label="Bar chart showing token status breakdown"><ResponsiveContainer width="100%" height="100%"><BarChart data={snapshot.statusBreakdown} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5edf5" /><XAxis dataKey="status" tick={{ fill: '#65748a', fontSize: 10 }} /><YAxis tick={{ fill: '#65748a', fontSize: 11 }} /><Tooltip formatter={(value) => [`${value} tokens`, 'Tokens']} /><Bar dataKey="count" name="Tokens" radius={[5, 5, 0, 0]}>{snapshot.statusBreakdown.map((entry, index) => <Cell key={entry.status} fill={statusColors[index % statusColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div></ChartPanel><ChartPanel title="Waiting vs service time" description="Department comparison in minutes." icon={<Clock3 size={19} />}><div className="admin-report-chart" role="img" aria-label="Bar chart comparing average waiting and service times"><ResponsiveContainer width="100%" height="100%"><BarChart data={snapshot.waitingComparison} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5edf5" /><XAxis dataKey="department" tick={{ fill: '#65748a', fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={54} /><YAxis unit="m" tick={{ fill: '#65748a', fontSize: 11 }} /><Tooltip formatter={(value) => [`${value} minutes`, '']} /><Bar dataKey="waiting" name="Average wait" fill="#2878d0" radius={[5, 5, 0, 0]} /><Bar dataKey="service" name="Average service" fill="#16a477" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartPanel><ChartPanel title="Hourly patient traffic" description="Peak-hour counts derived from saved token timestamps." icon={<Activity size={19} />}><div className="admin-report-chart" role="img" aria-label="Bar chart showing hourly token counts"><ResponsiveContainer width="100%" height="100%"><BarChart data={snapshot.hourlyTraffic} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5edf5" /><XAxis dataKey="hour" tick={{ fill: '#65748a', fontSize: 10 }} /><YAxis tick={{ fill: '#65748a', fontSize: 11 }} /><Tooltip formatter={(value) => [`${value} patients`, 'Tokens']} /><Bar dataKey="patients" name="Patients" fill="#153e75" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartPanel></section>
    <section className="admin-report-panel"><div className="admin-report-panel-heading"><div><p className="admin-kicker">DEPARTMENT PERFORMANCE</p><h2>Service performance table</h2><p>Metrics update with the selected date range and department filter.</p></div><span>{snapshot.rangeLabel}</span></div><div className="admin-report-table-wrap"><table className="admin-report-table"><thead><tr><th>Department</th><th>Total Patients</th><th>Avg Waiting Time</th><th>Avg Service Time</th><th>Completed Tokens</th><th>Pending Tokens</th></tr></thead><tbody>{snapshot.departmentPerformance.map((item) => <tr key={item.department}><th scope="row">{item.department}</th><td>{item.totalPatients.toLocaleString()}</td><td>{item.averageWaitingTime} min</td><td>{item.averageServiceTime} min</td><td>{item.completedTokens.toLocaleString()}</td><td>{item.pendingTokens.toLocaleString()}</td></tr>)}</tbody></table>{snapshot.departmentPerformance.length === 0 && <div className="admin-report-empty">No department data is available for this filter.</div>}</div></section><p className="admin-reports-footnote"><Activity size={15} /> Counts use saved records for the selected period. Waiting values are estimates; service durations are not recorded.</p></>
}

function SummaryCard({ label, value, detail, tone, icon }: { label: string; value: string; detail: string; tone: string; icon: React.ReactNode }) { return <article className="admin-report-summary-card"><span className={`admin-report-summary-icon admin-report-summary-icon--${tone}`}>{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article> }
function ChartPanel({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) { return <article className="admin-report-chart-panel"><div className="admin-report-chart-heading"><div><h2>{title}</h2><p>{description}</p></div><span>{icon}</span></div>{children}</article> }

function downloadCsv(snapshot: ReportSnapshot) {
  const rows = [['Report', 'SmartQueue AI Reports & Analytics'], ['Data range', snapshot.rangeLabel], ['Date start', snapshot.dateStart], ['Date end', snapshot.dateEnd], [], ['Department', 'Total Patients', 'Average Waiting Time (min)', 'Average Service Time (min)', 'Completed Tokens', 'Pending Tokens'], ...snapshot.departmentPerformance.map((item) => [item.department, item.totalPatients, item.averageWaitingTime, item.averageServiceTime, item.completedTokens, item.pendingTokens])]
  const csv = rows.map((row) => row.map((value) => csvValue(value)).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `smartqueue-report-${snapshot.dateStart}-to-${snapshot.dateEnd}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function csvValue(value: unknown) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text }
