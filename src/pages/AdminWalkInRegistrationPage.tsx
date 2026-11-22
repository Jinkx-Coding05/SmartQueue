import { CheckCircle2, ChevronRight, RotateCw, Ticket, UserRoundPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout'
import { useAuth } from '../context/useAuth'
import { adminApi } from '../services/api/adminApi'
import '../styles/walk-in-registration.css'

type DepartmentOption = { id: string; name: string }
type CounterOption = { id: string; number: string; name: string; departmentId: string }
type RegistrationResult = { patient: { fullName: string; phoneNumber: string }; token: Record<string, unknown> }

export function AdminWalkInRegistrationPage() {
  const { token } = useAuth()
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [counters, setCounters] = useState<CounterOption[]>([])
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [counterId, setCounterId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<RegistrationResult | null>(null)

  const loadOptions = useCallback(async () => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    try {
      const [departmentResult, counterResult] = await Promise.allSettled([
        adminApi.departments(token, { limit: 100, isActive: true }) as Promise<{ items: Array<Record<string, unknown>> }>,
        adminApi.counters(token, { limit: 100 }) as Promise<{ items: Array<Record<string, unknown>> }>,
      ])
      const messages: string[] = []
      const departmentPage = departmentResult.status === 'fulfilled' ? departmentResult.value : null
      const counterPage = counterResult.status === 'fulfilled' ? counterResult.value : null
      if (!departmentPage) messages.push(`Departments could not be loaded: ${failureMessage(departmentResult)}`)
      if (!counterPage) messages.push(`Counters could not be loaded: ${failureMessage(counterResult)}`)
      const nextDepartments = departmentPage?.items.map((item) => ({ id: String(item._id), name: String(item.name) })) ?? []
      setDepartments(nextDepartments)
      setCounters(counterPage?.items.filter((item) => (item.status === 'active' || item.status === 'available') && item.currentServingTokenId == null).map((item) => ({
        id: String(item._id), number: String(item.counterNumber), name: String(item.name),
        departmentId: String((item.department as { _id?: string; id?: string } | undefined)?._id ?? (item.department as { id?: string } | undefined)?.id ?? ''),
      })) ?? [])
      setDepartmentId((current) => nextDepartments.some((department) => department.id === current) ? current : '')
      setCounterId('')
      if (departmentPage && nextDepartments.length === 0) messages.push('No active departments are available. Activate a department before registering a walk-in patient.')
      setOptionsError(messages.join(' '))
    } catch (cause) {
      setOptionsError(cause instanceof Error ? cause.message : 'Departments and available counters could not be loaded.')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { queueMicrotask(() => { void loadOptions() }) }, [loadOptions])

  const departmentCounters = counters.filter((counter) => counter.departmentId === departmentId)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || submitting) return
    setSubmitting(true); setSubmitError(''); setResult(null)
    try {
      const saved = await adminApi.registerWalkInPatient(token, { fullName, phoneNumber, departmentId, counterId })
      setResult(saved)
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Walk-in patient could not be registered.')
    } finally { setSubmitting(false) }
  }

  const tokenNumber = result?.token.tokenNumber
  return <AdminDashboardLayout>
    <main className="walk-in-page">
      <div className="walk-in-breadcrumb"><Link to="/admin/dashboard">Admin Dashboard</Link><ChevronRight size={14} /><span>Register Walk-in Patient</span></div>
      <header className="walk-in-heading"><span className="walk-in-heading-icon"><UserRoundPlus size={22} /></span><div><p className="admin-kicker">QUEUE OPERATIONS</p><h1>Register Walk-in Patient</h1><p>Save a walk-in patient and create a queue token in the hospital database.</p></div></header>
      {optionsError && <div className="walk-in-error" role="alert"><span>{optionsError}</span><button type="button" onClick={() => void loadOptions()}><RotateCw size={14} /> Retry loading options</button></div>}
      {result ? <section className="walk-in-confirmation" aria-live="polite"><span><CheckCircle2 size={25} /></span><p className="admin-kicker">TOKEN CREATED</p><h2>{String(tokenNumber)}</h2><p>{result.patient.fullName} · {result.patient.phoneNumber}</p><dl><div><dt>Department</dt><dd>{String((result.token.department as { name?: string } | undefined)?.name ?? 'Selected department')}</dd></div><div><dt>Counter</dt><dd>{String((result.token.counter as { counterNumber?: string; name?: string } | undefined)?.counterNumber ?? (result.token.counter as { name?: string } | undefined)?.name ?? 'Selected counter')}</dd></div><div><dt>Status</dt><dd>Waiting</dd></div></dl><div className="walk-in-result-actions"><Link className="admin-action-button admin-action-button--secondary" to="/admin/queue-management">View queue</Link><button className="admin-action-button admin-action-button--primary" type="button" onClick={() => { setResult(null); setFullName(''); setPhoneNumber(''); setCounterId('') }}>Register another patient</button></div></section> : <section className="walk-in-form-card"><div className="walk-in-form-heading"><div><p className="admin-kicker">PATIENT DETAILS</p><h2>Walk-in information</h2></div><span><Ticket size={16} /> Token will join the waiting queue</span></div>
        {loading && <p role="status">Refreshing active departments and available counters…</p>}
        <form className="walk-in-form" onSubmit={submit}>
          <label>Patient name<input autoComplete="name" minLength={2} maxLength={120} required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter patient's full name" /></label>
          <label>Phone number<input autoComplete="tel" inputMode="tel" minLength={8} maxLength={24} required pattern="\+?[0-9]+" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="e.g. +919876543210" /></label>
          <label>Department<select required value={departmentId} disabled={loading || departments.length === 0} onChange={(event) => { setDepartmentId(event.target.value); setCounterId('') }}><option value="">{departments.length ? 'Choose a department' : 'No active departments available'}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label>Available counter<select required value={counterId} onChange={(event) => setCounterId(event.target.value)} disabled={loading || !departmentId || departmentCounters.length === 0}><option value="">{!departmentId ? 'Choose a department first' : departmentCounters.length ? 'Choose an available counter' : 'No available counter for this department'}</option>{departmentCounters.map((counter) => <option key={counter.id} value={counter.id}>{counter.number} · {counter.name}</option>)}</select></label>
          {departmentId && departmentCounters.length === 0 && <p className="walk-in-empty">This department has no available counter. Select another department or make a counter available.</p>}
          {submitError && <p className="walk-in-error" role="alert">{submitError}</p>}
          <p className="walk-in-help">If the phone number already belongs to a patient, their existing record is used without changing it. An active token for this department prevents a duplicate queue registration.</p>
          <button className="admin-action-button admin-action-button--primary" type="submit" disabled={submitting || !departmentId || !counterId || loading}>{submitting ? 'Registering…' : 'Register Patient'}</button>
        </form>
      </section>}
    </main>
  </AdminDashboardLayout>
}

function failureMessage(result: PromiseSettledResult<unknown>) {
  return result.status === 'rejected' && result.reason instanceof Error ? result.reason.message : 'API request failed.'
}
