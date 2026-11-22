import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, ChevronRight, Clock3, Info, Lightbulb, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'
import { adminApi } from '../services/api/adminApi'
import { useAuth } from '../context/useAuth'
import type { AdminAiInsights, AdminAiRecommendation, InsightConfidence } from '../types/aiInsights'
import '../styles/ai-insights.css'

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AdminAiInsightsPage() {
  const { token } = useAuth()
  const [insights, setInsights] = useState<AdminAiInsights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (!token) return
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const result = refresh ? await adminApi.refreshInsights(token) : await adminApi.insights(token)
      setInsights(result)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Insights could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])
  return <AdminDashboardLayout><div className="ai-insights-page">
    <header className="ai-insights-header">
      <div><div className="admin-breadcrumb"><Link to="/admin/dashboard">Admin Dashboard</Link><ChevronRight size={14} /><span>AI Insights</span></div><p className="admin-kicker">QUEUE ANALYSIS</p><h1>AI Insights</h1><p>Aggregate operational patterns, cautious wait estimates and explainable recommendations.</p></div>
      <div className="ai-insights-header-actions">
        {insights && <InsightSourceBadge analysis={insights.analysis} />}
        <button className="admin-action-button admin-action-button--secondary" type="button" disabled={loading || refreshing} onClick={() => void load(true)}><RefreshCw size={15} className={refreshing ? 'ai-refreshing' : ''} /> {refreshing ? 'Refreshing…' : 'Refresh analysis'}</button>
      </div>
    </header>

    {error && <div role="alert" className="ai-demo-notice"><Info size={17} /><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}
    {loading ? <p role="status">Loading aggregated queue analysis…</p> : insights && <>
      <div className="ai-demo-notice" role="status"><Info size={17} /><span>{insights.explanation} {insights.analysis.fallbackReason === 'missing-api-key' ? 'Configure GEMINI_API_KEY on the backend to enable Gemini explanations.' : ''}</span></div>

      <section className="ai-overview-grid" aria-label="Queue summary">
        <InsightCard icon={<Users size={19} />} label="Currently waiting" value={String(insights.waiting.count)} helper="Live waiting records" />
        <InsightCard icon={<Clock3 size={19} />} label="Stored wait estimate" value={`${insights.waiting.averageEstimatedWaitMinutes} min`} helper="Not measured actual wait" />
        <InsightCard icon={<BarChart3 size={19} />} label="Recorded peak hour" value={insights.peakHours[0] ? `${String(insights.peakHours[0].hour).padStart(2, '0')}:00` : 'No data'} helper={insights.peakHours[0] ? `${insights.peakHours[0].bookings} tokens recorded` : 'No token history'} />
        <InsightCard icon={<TrendingUp size={19} />} label="Forecast data" value={insights.peakPeriodAnalysis.forecast.status === 'available' ? 'Available' : 'Insufficient'} helper={`${insights.peakPeriodAnalysis.forecast.observedDays} observed days`} />
      </section>

      <section className="ai-insights-panel"><div className="ai-panel-heading"><div><h2>Operational outcomes</h2><p>Appointment volume and token outcomes from the last 90 days.</p></div></div><div className="ai-outcome-grid"><OutcomeMetric label="Appointments" value={insights.operationalSummary.appointments.total} /><OutcomeMetric label="Appointments completed" value={`${insights.operationalSummary.appointments.completed} · ${insights.operationalSummary.appointments.completionRate}%`} /><OutcomeMetric label="Appointments cancelled" value={`${insights.operationalSummary.appointments.cancelled} · ${insights.operationalSummary.appointments.cancellationRate}%`} /><OutcomeMetric label="Tokens completed" value={`${insights.operationalSummary.tokenOutcomes.completed} · ${insights.operationalSummary.tokenOutcomes.completionRate}%`} /><OutcomeMetric label="Tokens cancelled" value={`${insights.operationalSummary.tokenOutcomes.cancelled} · ${insights.operationalSummary.tokenOutcomes.cancellationRate}%`} /><OutcomeMetric label="Active counters" value={insights.operationalSummary.activeCounters} /></div></section>

      <section className="ai-chart-panel"><div className="ai-panel-heading"><div><h2>Historical queue trend</h2><p>Daily token aggregates; this history is descriptive, not a forecast.</p></div></div><div className="ai-chart">{insights.historicalQueueTrend.length >= 7 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={insights.historicalQueueTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="tokens" name="Tokens" stroke="#2878d0" dot={false} /><Line type="monotone" dataKey="completed" name="Completed" stroke="#16a477" dot={false} /><Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#dc5252" dot={false} /></LineChart></ResponsiveContainer> : <p className="ai-insufficient-state">Insufficient historical data to show a meaningful queue trend. At least seven token-active days are needed.</p>}</div></section>

      {insights.generatedAnalysis && <section className="ai-explanation-panel"><span className="ai-explanation-icon"><Lightbulb size={21} /></span><div><p className="admin-kicker">GEMINI EXPLANATION</p><h2>{insights.generatedAnalysis.summary}</h2><p>{insights.generatedAnalysis.historicalPattern}</p>{insights.generatedAnalysis.departmentNotes.length > 0 && <ul className="ai-department-notes">{insights.generatedAnalysis.departmentNotes.map((note) => <li key={note.department}><strong>{note.department}:</strong> {note.note}</li>)}</ul>}</div></section>}

      <section className="ai-chart-grid">
        <article className="ai-chart-panel"><div className="ai-panel-heading"><div><h2>Historical traffic by hour</h2><p>Recorded token creation counts; descriptive history, not a prediction.</p></div></div><div className="ai-chart">{insights.peakHours.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={insights.peakHours}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tickFormatter={(hour: number) => `${String(hour).padStart(2, '0')}:00`} /><YAxis allowDecimals={false} /><Tooltip labelFormatter={(hour) => `${String(hour).padStart(2, '0')}:00`} /><Bar dataKey="bookings" name="Recorded tokens" fill="#2878d0" /></BarChart></ResponsiveContainer> : <p>No historical token records in the analysis window.</p>}</div></article>
        <article className="ai-chart-panel"><div className="ai-panel-heading"><div><h2>Peak-period analysis</h2><p>Weekday averages are shown only with enough historical coverage.</p></div></div>
          <PeakPeriodSummary forecast={insights.peakPeriodAnalysis.forecast} />
        </article>
      </section>

      <section className="ai-insights-panel"><div className="ai-panel-heading"><div><h2>Department performance</h2><p>Traffic and stored waiting estimates from aggregated records.</p></div></div>
        {insights.departmentPerformance.length ? <div className="congestion-grid">{insights.departmentPerformance.map((item) => { const pressure = insights.queuePressure.find((row) => row.department === item.department.name); return <article className="congestion-card" key={item.department.name}><h3>{item.department.name}</h3><div className="congestion-metrics"><span><small>Tokens</small><strong>{item.tokens}</strong></span><span><small>Stored wait</small><strong>{Math.round(item.avgWaitEstimate)} min</strong></span></div>{pressure && <p><strong>Queue pressure:</strong> {pressure.level} · {pressure.waitingTokens} waiting / {pressure.activeCounters} active counters</p>}</article> })}</div> : <p>No department history is available yet.</p>}
      </section>

      <section className="ai-insights-panel"><div className="ai-panel-heading"><div><h2>Waiting-time analysis</h2><p>{insights.waitTimeAnalysis.disclaimer}</p></div></div>
        {insights.waitTimeAnalysis.departments.length ? <div className="ai-wait-forecast-grid">{insights.waitTimeAnalysis.departments.map((item) => <article className="ai-wait-forecast" key={item.department}><div><h3>{item.department}</h3><ConfidenceBadge confidence={item.confidence} /></div><strong>{item.estimatedWaitingTimeMinutes} min</strong><small>{item.reliability === 'historical-completed-service-duration' ? 'Derived from completed service durations' : 'Rule-based stored estimate; service duration history is insufficient'}</small><ul>{item.factors.map((factor) => <li key={factor.name}>{factor.name}: {factor.value}</li>)}</ul></article>)}</div> : <p className="ai-insufficient-state">No department data is available for wait-time analysis.</p>}
      </section>

      <section className="ai-insights-panel"><div className="ai-panel-heading"><div><p className="admin-kicker">ADMIN REVIEW REQUIRED</p><h2>Recommendations</h2><p>Suggestions do not change counters, appointments, tokens or settings.</p></div><Lightbulb size={19} /></div>
        {insights.recommendations.length ? <div className="recommendation-grid">{insights.recommendations.map((item, index) => <RecommendationCard item={item} key={`${item.source}-${item.title}-${index}`} />)}</div> : <p>No recommendations meet the current evidence thresholds.</p>}
      </section>
      <p className="ai-disclaimer"><Info size={15} /> Source: {insights.dataSource}. Analysis updated {new Date(insights.analysis.timestamp).toLocaleString()}.</p>
    </>}
  </div></AdminDashboardLayout>
}

function InsightCard({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return <article className="ai-summary-card"><span className="ai-summary-icon ai-summary-icon--blue">{icon}</span><p>{label}</p><strong>{value}</strong><small>{helper}</small></article>
}

function OutcomeMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="ai-outcome-metric"><span>{label}</span><strong>{value}</strong></div>
}

function ConfidenceBadge({ confidence }: { confidence: InsightConfidence }) {
  return <span className={`ai-confidence ai-confidence--${confidence}`}>{confidence} confidence</span>
}

export function RecommendationCard({ item }: { item: AdminAiRecommendation }) {
  return <article className="recommendation-card"><div className="recommendation-heading"><span className="recommendation-icon"><AlertTriangle size={17} /></span><span className={`priority-badge priority-badge--${item.severity}`}>{item.severity} priority</span></div><h3>{item.title}</h3>{item.department && <p><strong>Department:</strong> {item.department}</p>}<p>{item.reason}</p><p><strong>Suggested action:</strong> {item.suggestedAction}</p><p><strong>Reliability:</strong> <ConfidenceBadge confidence={item.confidence} /> · {item.source === 'gemini' ? 'Gemini' : 'Rule-based'}</p>{item.supportingDatabaseMetrics.length > 0 && <ul className="ai-evidence-list">{item.supportingDatabaseMetrics.map((metric) => <li key={metric.key}>{metric.key.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}: {metric.value ?? 'Unavailable'}</li>)}</ul>}</article>
}

export function InsightSourceBadge({ analysis }: { analysis: AdminAiInsights['analysis'] }) {
  const label = analysis.provider === 'gemini' ? `Gemini analysis · ${analysis.model}` : 'Rule-based fallback'
  return <span className={`ai-demo-indicator ${analysis.provider === 'gemini' ? 'ai-demo-indicator--gemini' : ''}`}><TrendingUp size={17} /> {label}</span>
}

export function PeakPeriodSummary({ forecast }: { forecast: AdminAiInsights['peakPeriodAnalysis']['forecast'] }) {
  if (forecast.status !== 'available') return <p className="ai-insufficient-state">Insufficient historical data for a weekday forecast. At least {forecast.minimumObservedDays} observed days and 100 tokens are required; {forecast.observedDays} days and {forecast.historicalTokenCount} tokens are available.</p>
  return <div className="ai-forecast-list">{forecast.expectedByWeekday.map((item) => <div className="ai-forecast-row" key={item.weekday}><span>{weekdayNames[item.weekday] ?? `Day ${item.weekday}`}</span><strong>{item.averageTokens} tokens</strong><small>average across {item.observedDays} days</small></div>)}</div>
}
