import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, FileCheck2, Hospital, MapPin, ShieldCheck, Ticket, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { formatBookingDate, getBookingDocuments, getNextAvailableDate, visitTypes } from '../services/mock/bookingData'
import type { ServiceCenter } from '../services/mock/bookingData'
import { bookToken, getDepartments } from '../services/api/citizenApi'
import { getPublicStatistics } from '../services/api/publicApi'
import type { DepartmentApi } from '../types/citizenApi'
import { useAuth } from '../context/useAuth'
import '../styles/booking.css'

type BookingErrors = Partial<Record<'center' | 'department' | 'visitType' | 'date' | 'time' | 'documents', string>>

type Confirmation = {
  id: string
  token: string
  center: ServiceCenter
  department: string
  visitType: string
  date: string
  time: string
  wait: string
}

export function BookingPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentApi[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [center, setCenter] = useState<ServiceCenter | null>(null)
  const [department, setDepartment] = useState('')
  const [visitType, setVisitType] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [checkedDocuments, setCheckedDocuments] = useState<string[]>([])
  const [errors, setErrors] = useState<BookingErrors>({})
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const documents = useMemo(() => getBookingDocuments(visitType), [visitType])
  const minDate = getNextAvailableDate(1)
  useEffect(() => { let active = true; getDepartments().then((list) => { if (active) { setDepartmentOptions(list); setApiError('') } }).catch((cause) => { if (active) setApiError(cause instanceof Error ? cause.message : 'Could not load departments.') }).finally(() => { if (active) setLoadingDepartments(false) }); getPublicStatistics('today').then((data) => { if (active) setCenter({ id: 'configured-service-center', name: data.serviceCenter.name, location: 'Location not configured', services: [] }) }).catch(() => { if (active) setApiError('Service center information is unavailable.') }); return () => { active = false } }, [])

  const toggleDocument = (id: string) => setCheckedDocuments((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const validate = (): BookingErrors => {
    const nextErrors: BookingErrors = {}
    if (!center) nextErrors.center = 'Select a service center to continue.'
    if (!department) nextErrors.department = 'Select a department.'
    if (!visitType) nextErrors.visitType = 'Select a visit type.'
    if (!date) nextErrors.date = 'Choose a visit date.'
    if (!time) nextErrors.time = 'Choose an available time slot.'
    if (!checkedDocuments.includes('government-id')) nextErrors.documents = 'Confirm that you will bring your Government ID.'
    return nextErrors
  }

  const handleConfirm = async () => {
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (!token) { setApiError('Your session has expired. Sign in again to book a token.'); return }
    const selectedDepartment = departmentOptions.find((item) => item.name === department)
    if (!selectedDepartment) { setApiError('Select an available department.'); return }
    setSubmitting(true); setApiError('')
    try { const booked = await bookToken(token, { departmentId: selectedDepartment.id, preferredVisitDate: date, preferredTime: time, visitType }); setConfirmation({ id: booked.id, token: booked.tokenNumber, center: center!, department: selectedDepartment.name, visitType: booked.visitType ?? visitType, date: booked.preferredVisitDate ?? booked.bookingDate, time: booked.preferredTime ?? time, wait: `${booked.estimatedWaitingTime} minutes` }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    catch (cause) { setApiError(cause instanceof Error ? cause.message : 'Token booking failed.') } finally { setSubmitting(false) }
  }

  if (confirmation) return <DashboardLayout><BookingConfirmation confirmation={confirmation} onReturn={() => navigate('/citizen/dashboard')} /></DashboardLayout>

  return <DashboardLayout><motion.div className="booking-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
    <div className="booking-page-header"><div><div className="booking-breadcrumb"><Link to="/citizen/dashboard">Dashboard</Link><ChevronRight size={14} /><span>Book Token</span></div><p className="dashboard-kicker">PLAN YOUR VISIT</p><h1>Book Your Token</h1><p>Reserve your place in line before you visit a service center.</p></div><div className="booking-demo-badge"><ShieldCheck size={16} /> Connected service</div></div>
    <div className="booking-layout"><div className="booking-form-column">
      <BookingStep number="01" title="Service center" icon={<Hospital size={19} />} error={errors.center}><div className="center-options">{center ? <div className="center-option center-option--selected"><span className="center-option-icon"><Hospital size={19} /></span><span><strong>{center.name}</strong><small><MapPin size={13} /> {center.location}</small><em>Service center information from the backend</em></span><CheckCircle2 className="selected-check" size={18} /></div> : <p role="status">Loading configured service center…</p>}</div></BookingStep>
      <BookingStep number="02" title="Select a department" icon={<UsersRound size={19} />} error={errors.department}>{loadingDepartments ? <p role="status">Loading available departments…</p> : departmentOptions.length ? <div className="choice-grid choice-grid--departments">{departmentOptions.filter((item) => item.available).map((item) => <button className={`choice-pill ${department === item.name ? 'choice-pill--selected' : ''}`} type="button" key={item.id} onClick={() => { setDepartment(item.name); setErrors((current) => ({ ...current, department: undefined })) }}>{item.name}{department === item.name && <Check size={14} />}</button>)}</div> : <p role="status">No departments are currently available.</p>}</BookingStep>
      <BookingStep number="03" title="Choose your visit type" icon={<Ticket size={19} />} error={errors.visitType}><div className="choice-grid choice-grid--visit-types">{visitTypes.map((item) => <button className={`visit-type-option ${visitType === item ? 'visit-type-option--selected' : ''}`} type="button" key={item} onClick={() => { setVisitType(item); setErrors((current) => ({ ...current, visitType: undefined })) }}><span>{item === 'Emergency' ? 'Priority care' : item === 'Follow-up' ? 'Returning visit' : 'First-time visit'}</span><strong>{item}</strong></button>)}</div></BookingStep>
      <BookingStep number="04" title="Select date and time" icon={<CalendarDays size={19} />} error={errors.date ?? errors.time}><div className="date-field"><label htmlFor="visit-date">Visit date</label><div className="date-input-wrap"><CalendarDays size={17} /><input id="visit-date" type="date" min={minDate} value={date} onChange={(event) => { setDate(event.target.value); setErrors((current) => ({ ...current, date: undefined })) }} /></div><small>Available from tomorrow. The backend validates department hours.</small></div><div className="time-slot-section"><div className="time-slot-heading"><label htmlFor="visit-time">Preferred time</label></div><div className="date-input-wrap"><Clock3 size={17} /><input id="visit-time" type="time" value={time} onChange={(event) => { setTime(event.target.value); setErrors((current) => ({ ...current, time: undefined })) }} /></div></div></BookingStep>
      <BookingStep number="05" title="Confirm your documents" icon={<FileCheck2 size={19} />} error={errors.documents}><p className="step-helper">Check the documents you plan to bring. This is a preparation checklist for your appointment.</p><div className="document-options">{documents.map((document) => <label className={`document-option ${checkedDocuments.includes(document.id) ? 'document-option--checked' : ''}`} key={document.id}><input type="checkbox" checked={checkedDocuments.includes(document.id)} onChange={() => toggleDocument(document.id)} /><span className="document-check"><Check size={14} /></span><span><strong>{document.label}{document.required && <em>Required</em>}</strong><small>{document.note}</small></span></label>)}</div></BookingStep>
      <p className="step-helper">Your selected date, time and visit type are saved with the token as visit preferences. The token joins today&apos;s queue; this does not create a scheduled appointment.</p>
      {apiError && <p className="booking-error" role="alert">{apiError} <button type="button" onClick={() => { setLoadingDepartments(true); setApiError(''); void getDepartments().then(setDepartmentOptions).catch((e: unknown) => setApiError(e instanceof Error ? e.message : 'Retry failed.')).finally(() => setLoadingDepartments(false)) }}>Retry</button></p>}
      <div className="booking-form-actions"><Link className="button button--secondary" to="/citizen/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link><button className="button button--primary" type="button" onClick={() => void handleConfirm()} disabled={submitting || loadingDepartments}>{submitting ? 'Booking…' : 'Confirm & generate token'} <ArrowRight size={16} /></button></div>
    </div><BookingSummary center={center} department={department} visitType={visitType} date={date} time={time} documents={documents} checkedDocuments={checkedDocuments} /></div>
  </motion.div></DashboardLayout>
}

function BookingStep({ number, title, icon, error, children }: { number: string; title: string; icon: ReactNode; error?: string; children: ReactNode }) {
  return <section className="booking-step"><div className="booking-step-heading"><span className="booking-step-number">{number}</span><span className="booking-step-icon">{icon}</span><h2>{title}</h2></div>{children}{error && <p className="booking-error" role="alert">{error}</p>}</section>
}

function BookingSummary({ center, department, visitType, date, time, documents, checkedDocuments }: { center: ServiceCenter | null; department: string; visitType: string; date: string; time: string; documents: ReturnType<typeof getBookingDocuments>; checkedDocuments: string[] }) {
  const [hour, minute] = time.split(':').map(Number)
  const selectedTime = time ? new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : undefined
  const summaryRows = [['Service center', center?.name ?? 'Not selected'], ['Department', department || 'Not selected'], ['Visit type', visitType || 'Not selected'], ['Date', formatBookingDate(date)], ['Time slot', selectedTime ?? 'Not selected']]
  return <aside className="booking-summary"><div className="summary-heading"><span className="summary-icon"><Ticket size={18} /></span><div><p className="dashboard-kicker">BOOKING SUMMARY</p><h2>Your selections</h2></div></div><div className="summary-rows">{summaryRows.map(([label, value]) => <div className="summary-row" key={label}><span>{label}</span><strong className={value === 'Not selected' ? 'summary-placeholder' : ''}>{value}</strong></div>)}</div><div className="summary-documents"><div><FileCheck2 size={16} /><strong>Documents checklist</strong></div>{documents.map((document) => <p key={document.id}><span className={checkedDocuments.includes(document.id) ? 'summary-doc-check summary-doc-check--checked' : 'summary-doc-check'}>{checkedDocuments.includes(document.id) && <Check size={11} />}</span>{document.label}</p>)}</div><div className="summary-note"><Clock3 size={15} /><span>Waiting time is an estimate returned by the backend.</span></div></aside>
}

function BookingConfirmation({ confirmation, onReturn }: { confirmation: Confirmation; onReturn: () => void }) {
  return <motion.section className="booking-confirmation" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .3 }}><div className="confirmation-icon"><CheckCircle2 size={32} /></div><p className="dashboard-kicker">TOKEN CONFIRMED</p><h1>Your token has been booked</h1><p className="confirmation-lead">This booking is recorded by SmartQueue AI for the current service day.</p><div className="confirmation-token"><span>Your token number</span><strong>{confirmation.token}</strong><small>Keep this number handy for your visit.</small></div><div className="confirmation-details"><div><span>Service center</span><strong>{confirmation.center.name}</strong></div><div><span>Department</span><strong>{confirmation.department}</strong></div><div><span>Booking date & time</span><strong>{formatBookingDate(confirmation.date)} · {confirmation.time}</strong></div><div><span>Estimated waiting time</span><strong>{confirmation.wait}</strong></div></div><div className="confirmation-actions"><Link className="button button--primary" to={`/citizen/queue/${confirmation.id}`}>Track My Queue <ArrowRight size={16} /></Link><button className="button button--secondary" type="button" onClick={onReturn}>Return to dashboard</button></div></motion.section>
}
