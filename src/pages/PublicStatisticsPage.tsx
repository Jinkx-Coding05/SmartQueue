import { motion } from 'framer-motion'
import { Activity, ArrowLeft, BarChart3, Clock3, MapPin, Users, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cell, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BrandLogo } from '../components/common/BrandLogo'
import type { StatisticsPeriod } from '../services/mock/publicStatisticsData'
import { getPublicStatistics } from '../services/api/publicApi'
import type { PublicStatisticsApi } from '../services/api/publicApi'
import type { StatisticsSnapshot } from '../services/mock/publicStatisticsData'
import '../styles/public-statistics.css'

const periodOptions: Array<{ value: StatisticsPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
]

const summaryCards = [
  { key: 'tokensGenerated', label: 'Total Tokens Generated', icon: Activity },
  { key: 'patientsServed', label: 'Patients Served', icon: Users },
  { key: 'averageWait', label: 'Average Waiting Time', icon: Clock3 },
  { key: 'activeCenters', label: 'Active Counters', icon: MapPin },
] as const

const chartTooltip = {
  contentStyle: { borderRadius: 12, border: '1px solid #DCE6F2', boxShadow: '0 8px 24px rgba(21, 62, 117, 0.12)' },
}

export function PublicStatisticsPage() {
  const [period, setPeriod] = useState<StatisticsPeriod>('7d')
  const [snapshot, setSnapshot] = useState<StatisticsSnapshot>(() => emptyStatisticsSnapshot())
  const [source, setSource] = useState<'live' | 'unavailable'>('unavailable')
  const [loadedPeriod, setLoadedPeriod] = useState<StatisticsPeriod | null>(null)
  const loading = loadedPeriod !== period
  useEffect(() => { let active = true; getPublicStatistics(period).then((data) => { if (active) { setSnapshot(mapPublicStatistics(data)); setSource('live') } }).catch(() => { if (active) { setSnapshot(emptyStatisticsSnapshot()); setSource('unavailable') } }).finally(() => { if (active) setLoadedPeriod(period) }); return () => { active = false } }, [period])

  return (
    <div className="public-statistics-page">
      <header className="public-statistics-header">
        <div className="container public-statistics-header__inner">
          <BrandLogo />
          <nav className="public-statistics-nav" aria-label="Public statistics navigation">
            <Link to="/">Home</Link>
            <Link to="/login">Login</Link>
          </nav>
        </div>
      </header>

      <motion.main className="container public-statistics-main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="public-statistics-breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span>Public Statistics</span></div>
        <section className="public-statistics-hero" aria-labelledby="public-statistics-title">
          <div>
            <span className="eyebrow">PUBLIC TRANSPARENCY</span>
            <h1 id="public-statistics-title">Public Service Statistics</h1>
            <p>Aggregated queue performance and availability from participating services.</p>
          </div>
          <span className="demo-label"><BarChart3 size={16} /> {source === 'live' ? 'Live aggregated data' : 'Statistics unavailable'}</span>
        </section>

        <section className="statistics-toolbar" aria-label="Statistics filters">
          <div>
            <p className="toolbar-label">Reporting period</p>
            <div className="period-filters" role="group" aria-label="Choose reporting period">
              {periodOptions.map((option) => (
                <button key={option.value} type="button" aria-pressed={period === option.value} className={period === option.value ? 'period-filter period-filter--active' : 'period-filter'} onClick={() => setPeriod(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="toolbar-note" role="status">{loading ? 'Loading public statistics…' : source === 'live' ? 'Counts are aggregated from MongoDB. Wait values are stored estimates.' : 'The statistics API is unavailable; no sample figures are shown.'}</p>
        </section>

        <section className="statistics-summary-grid" aria-label="Overview statistics">
          {summaryCards.map(({ key, label, icon: Icon }) => (
            <article className="statistics-summary-card" key={key}>
              <span className="statistics-summary-card__icon"><Icon size={20} /></span>
              <p>{label}</p>
              <strong>{snapshot.summary[key]}</strong>
            </article>
          ))}
        </section>

        <section className="statistics-chart-grid" aria-label="Waiting time analytics">
          <article className="statistics-panel" aria-describedby="waiting-trend-description">
            <div className="statistics-panel__heading"><div><h2>Average waiting time</h2><p id="waiting-trend-description">Average estimated wait across the selected period.</p></div><TrendingUp size={20} /></div>
            <div className="statistics-chart" role="img" aria-label="Line chart of average waiting time">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshot.waitingTrend} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6EDF5" />
                  <XAxis dataKey="label" tick={{ fill: '#65748A', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#65748A', fontSize: 12 }} unit="m" />
                  <Tooltip {...chartTooltip} formatter={(value) => [`${value} minutes`, 'Average wait']} />
                  <Line type="monotone" dataKey="wait" stroke="#2878D0" strokeWidth={3} dot={{ r: 4, fill: '#2878D0' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
          <article className="statistics-panel" aria-describedby="department-chart-description">
            <div className="statistics-panel__heading"><div><h2>Wait by department</h2><p id="department-chart-description">Comparison of average estimated waiting time.</p></div><BarChart3 size={20} /></div>
            <div className="statistics-chart" role="img" aria-label="Bar chart comparing average waiting time by department">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshot.departmentPerformance} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6EDF5" />
                  <XAxis dataKey="department" tick={{ fill: '#65748A', fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={54} />
                  <YAxis tick={{ fill: '#65748A', fontSize: 12 }} unit="m" />
                  <Tooltip {...chartTooltip} formatter={(value) => [`${value} minutes`, 'Average wait']} />
                  <Bar dataKey="averageWait" radius={[6, 6, 0, 0]}>
                    {snapshot.departmentPerformance.map((entry) => <Cell key={entry.department} fill={entry.performance === 'Busy' ? '#F2A93B' : '#2878D0'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="statistics-panel statistics-panel--wide" aria-labelledby="department-performance-title">
          <div className="statistics-panel__heading"><div><h2 id="department-performance-title">Department performance</h2><p>Aggregated MongoDB counts by department.</p></div><Activity size={20} /></div>
          <div className="performance-table-wrap"><table className="performance-table"><thead><tr><th>Department</th><th>Avg. wait</th><th>Patients served</th><th>Queue size</th><th>Performance</th></tr></thead><tbody>{snapshot.departmentPerformance.map((entry) => <tr key={entry.department}><th scope="row">{entry.department}</th><td>{entry.averageWait} min</td><td>{entry.patientsServed.toLocaleString()}</td><td>{entry.queueSize}</td><td><span className={`performance-status performance-status--${entry.performance.toLowerCase()}`}>{entry.performance}</span></td></tr>)}</tbody></table></div>
        </section>

        <section className="statistics-panel statistics-panel--wide" aria-labelledby="service-centers-title">
          <div className="statistics-panel__heading"><div><h2 id="service-centers-title">Service center comparison</h2><p>One hospital-wide aggregate; individual centers are not modeled yet.</p></div><MapPin size={20} /></div>
          <div className="service-center-grid">{snapshot.serviceCenters.map((center) => <article className="service-center-card" key={center.name}><div><h3>{center.name}</h3><p><MapPin size={14} /> {center.location}</p></div><dl><div><dt>Patients served</dt><dd>{center.patientsServed.toLocaleString()}</dd></div><div><dt>Avg. wait</dt><dd>{center.averageWait} min</dd></div><div><dt>Queue size</dt><dd>{center.queueSize}</dd></div></dl></article>)}</div>
        </section>

        <section className="statistics-panel statistics-panel--wide" aria-labelledby="peak-hours-title">
          <div className="statistics-panel__heading"><div><h2 id="peak-hours-title">Peak hours analysis</h2><p>Token creation counts grouped by hour.</p></div><Clock3 size={20} /></div>
          <div className="statistics-chart statistics-chart--peak" role="img" aria-label="Bar chart showing queue volume by hour"><ResponsiveContainer width="100%" height="100%"><BarChart data={snapshot.peakHours} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#E6EDF5" /><XAxis dataKey="hour" tick={{ fill: '#65748A', fontSize: 12 }} /><YAxis tick={{ fill: '#65748A', fontSize: 12 }} /><Tooltip {...chartTooltip} formatter={(value) => [`${value} tokens`, 'Queue volume']} /><Bar dataKey="volume" fill="#153E75" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <p className="statistics-insight"><TrendingUp size={17} /> Descriptive historical counts only; this is not a prediction.</p>
        </section>

        <footer className="public-statistics-footer"><Link to="/"><ArrowLeft size={16} /> Back to SmartQueue AI home</Link><span>{source === 'live' ? 'Aggregated data only; no personal records are exposed.' : 'Live statistics are unavailable.'}</span></footer>
      </motion.main>
    </div>
  )
}

function mapPublicStatistics(data: PublicStatisticsApi): StatisticsSnapshot {
  const total = data.summary.tokensGenerated
  const served = data.summary.patientsServed
  const average = data.summary.averageEstimatedWaitMinutes
  const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
  const departments = data.departmentPerformance.map((item) => ({ department: item.department, averageWait: item.averageEstimatedWaitMinutes, patientsServed: item.patientsServed, queueSize: item.queueSize, performance: item.queueSize >= 10 ? 'Busy' as const : item.queueSize >= 4 ? 'Monitor' as const : 'Good' as const }))
  const hours = data.peakHours.map((item) => ({ hour: new Date(2000, 0, 1, item.hour).toLocaleTimeString('en-IN', { hour: 'numeric' }), volume: item.tokenCount }))
  return { summary: { tokensGenerated: total.toLocaleString(), patientsServed: served.toLocaleString(), averageWait: `${average} min`, activeCenters: String(data.summary.activeCounters) }, waitingTrend: data.waitingTrend.map((item) => ({ label: dateLabel(item.date), wait: item.averageEstimatedWaitMinutes })), departmentPerformance: departments, serviceCenters: [{ name: data.serviceCenter.name, location: 'Hospital-wide aggregate', patientsServed: served, averageWait: average, queueSize: departments.reduce((sum, item) => sum + item.queueSize, 0) }], peakHours: hours }
}

function emptyStatisticsSnapshot(): StatisticsSnapshot {
  return { summary: { tokensGenerated: '—', patientsServed: '—', averageWait: '—', activeCenters: '—' }, waitingTrend: [], departmentPerformance: [], serviceCenters: [], peakHours: [] }
}
