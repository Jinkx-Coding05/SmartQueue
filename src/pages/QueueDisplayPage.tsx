import { CheckCircle2, Clock3, Maximize2, Monitor, Moon, RefreshCw, Sun, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getQueueDisplay, type QueueDisplayApi, type QueueDisplayEntry } from '../services/api/queueDisplayApi'
import { useAppPreferences } from '../context/AppPreferences'
import '../styles/queue-display.css'

const clockFormat = (date: Date, timeZone: string) => new Intl.DateTimeFormat('en-IN', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(date)

export function QueueDisplayPage() {
  const { language, setLanguage, theme, toggleTheme } = useAppPreferences()
  const [display, setDisplay] = useState<QueueDisplayApi | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const refresh = useCallback(async () => {
    try { setDisplay(await getQueueDisplay()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Live queue data is temporarily unavailable.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    queueMicrotask(() => { void refresh() })
    const poll = window.setInterval(() => void refresh(), 12_000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    const initial = window.setTimeout(() => setNow(Date.now()), 0)
    const fullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', fullscreenChange)
    return () => { window.clearInterval(poll); window.clearInterval(clock); window.clearTimeout(initial); document.removeEventListener('fullscreenchange', fullscreenChange) }
  }, [refresh])
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) { try { await document.documentElement.requestFullscreen() } catch { setError('Fullscreen mode is unavailable in this browser.') } }
    else await document.exitFullscreen()
  }
  const timeZone = display?.timeZone ?? 'Asia/Kolkata'
  const time = now ? clockFormat(new Date(now), timeZone) : '—'
  return <main className="queue-display-page">
    <header className="queue-display-header"><div className="queue-display-brand"><span className="queue-display-mark"><Monitor size={26} /></span><div><p>SMARTQUEUE AI</p><h1>Hospital Live Queue</h1><time>{time}</time></div></div><div className="queue-display-toolbar"><span className={`queue-display-connection ${error ? 'is-offline' : display ? 'is-online' : ''}`}><span />{error ? <><WifiOff size={17} /> Disconnected</> : display ? <><Wifi size={17} /> Connected</> : <><RefreshCw size={16} /> Connecting</>}</span><label><span className="sr-only">Language</span><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'mr')}><option value="en">English</option><option value="mr">मराठी</option></select></label><button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><button className="queue-display-fullscreen" type="button" onClick={() => void toggleFullscreen()}><Maximize2 size={18} />{fullscreen ? 'Exit full screen' : 'Full screen'}</button></div></header>
    {error && <div className="queue-display-alert" role="alert">{display ? `Live connection lost. Showing the last successful update. ${error}` : error}<button type="button" onClick={() => { setLoading(true); void refresh() }}>Retry</button></div>}
    {loading && !display ? <div className="queue-display-state" role="status"><RefreshCw className="queue-display-spin" /> Loading live queue…</div> : !display ? <div className="queue-display-state"><WifiOff /><h2>Queue display unavailable</h2><button type="button" onClick={() => { setLoading(true); void refresh() }}>Retry</button></div> : <>
      <div className="queue-display-meta"><span><Clock3 size={17} /> Last updated {new Date(display.lastUpdatedAt).toLocaleTimeString('en-IN', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span>Refreshes every {display.refreshIntervalSeconds} seconds</span></div>
      {display.departments.length === 0 ? <div className="queue-display-state"><CheckCircle2 /><h2>No active departments</h2></div> : <div className="queue-display-departments">{display.departments.map((department) => {
        const active = department.entries.filter((entry) => entry.status === 'serving' || entry.status === 'waiting')
        const closed = department.entries.filter((entry) => entry.status === 'completed' || entry.status === 'skipped')
        return <section className="queue-display-department" key={department.id}><header><div><p>DEPARTMENT</p><h2>{department.name}</h2></div><span>{department.activeCounters.length} active counter{department.activeCounters.length === 1 ? '' : 's'}</span></header>
          {active.length === 0 && <p className="queue-display-empty">No patients are currently in this queue.</p>}
          {active.length > 0 && <div className="queue-display-table-wrap"><table><thead><tr><th>Queue</th><th>Token</th><th>Priority</th><th>Status</th><th>Counter</th><th>Estimated wait</th></tr></thead><tbody>{active.map((entry) => <QueueRow entry={entry} key={entry.tokenId} />)}</tbody></table></div>}
          {closed.length > 0 && <div className="queue-display-recent"><p>RECENTLY CLOSED</p>{closed.map((entry: QueueDisplayEntry) => <span className={`queue-display-closed queue-display-closed--${entry.status}`} key={entry.tokenId}><strong>{entry.tokenId}</strong> · {entry.status === 'completed' ? 'Completed' : 'Skipped'}</span>)}</div>}
        </section>
      })}</div>}
      <footer className="queue-display-footer">Estimated waiting times are informational and may change as the live queue changes.</footer>
    </>}
  </main>
}

function QueueRow({ entry }: { entry: QueueDisplayEntry }) {
  return <tr className={entry.status === 'serving' ? 'is-serving' : ''}><td>{entry.sequence ?? '—'}</td><th scope="row">{entry.tokenId}</th><td><span className={`queue-display-priority queue-display-priority--${entry.priority}`}>{entry.priority}</span></td><td><span className={`queue-display-status queue-display-status--${entry.status}`}><i />{entry.status}</span></td><td>{entry.counter ?? '—'}</td><td>{entry.status === 'serving' ? 'Now serving' : entry.estimatedWaitingTimeMinutes === null ? 'Unavailable' : `${entry.estimatedWaitingTimeMinutes} min`}</td></tr>
}
