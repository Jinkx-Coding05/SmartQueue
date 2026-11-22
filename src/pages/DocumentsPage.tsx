import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, CircleHelp, FileCheck2, FileImage, FileText, Info, ShieldCheck, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { useAuth } from '../context/useAuth'
import { createDocument, deleteDocument, getMyDocuments } from '../services/api/citizenApi'
import type { CitizenDocumentApi } from '../types/citizenApi'
import { formatBookingDate } from '../services/mock/bookingData'
import { documentDefinitions, formatDocumentSize, getUpcomingAppointmentRequirements, isAcceptedDocument } from '../services/mock/documentService'
import type { DocumentDefinition, DocumentStatus } from '../services/mock/documentService'
import type { Appointment } from '../services/mock/appointmentService'
import '../styles/documents.css'

const MAX_FILE_SIZE = 5 * 1024 * 1024
type DocumentItem = DocumentDefinition & { file: File | null; previewUrl: string; serverId?: string }

export function DocumentsPage() {
  const { token } = useAuth()
  const [documents, setDocuments] = useState<DocumentItem[]>(() => documentDefinitions.map((document) => ({ ...document, file: null, previewUrl: '' })))
  const [uploadError, setUploadError] = useState<{ id: string; message: string } | null>(null)
  const [message, setMessage] = useState('')
  const [removeTarget, setRemoveTarget] = useState<DocumentItem | null>(null)
  const previewUrls = useRef(new Set<string>())
  useEffect(() => { if (!token) return; let active = true; getMyDocuments(token, { limit: 100 }).then((result) => { if (!active) return; setDocuments((current) => current.map((item) => { const saved = result.items.find((document: CitizenDocumentApi) => document.documentType === item.name); return saved ? { ...item, id: item.id, status: 'uploaded', serverId: saved.id } : item })) }).catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : 'Document records could not be loaded.')); return () => { active = false } }, [token])
  const upcomingRequirements = useMemo(() => getUpcomingAppointmentRequirements(), [])

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const counts = useMemo(() => ({ total: documents.length, uploaded: documents.filter((document) => document.status === 'uploaded').length, pending: documents.filter((document) => document.status !== 'uploaded').length, required: documents.filter((document) => document.mandatory && document.status !== 'uploaded').length }), [documents])
  const identityDocuments = documents.filter((document) => document.category === 'identity')
  const medicalDocuments = documents.filter((document) => document.category === 'medical')
  const missingAppointmentDocuments = upcomingRequirements?.requiredDocumentIds.filter((id) => documents.find((document) => document.id === id)?.status !== 'uploaded') ?? []

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, documentId: string) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isAcceptedDocument(file)) { setUploadError({ id: documentId, message: 'Unsupported file type. Please choose a PDF, JPG, JPEG or PNG file.' }); return }
    if (file.size > MAX_FILE_SIZE) { setUploadError({ id: documentId, message: 'This file is larger than 5 MB. Choose a smaller copy and try again.' }); return }

    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    if (previewUrl) previewUrls.current.add(previewUrl)
    setDocuments((current) => current.map((document) => {
      if (document.id !== documentId) return document
      if (document.previewUrl) { URL.revokeObjectURL(document.previewUrl); previewUrls.current.delete(document.previewUrl) }
      return { ...document, status: 'uploaded', file, previewUrl }
    }))
    setUploadError(null)
    if (!token) { setUploadError({ id: documentId, message: 'Your session has expired.' }); return }
    void createDocument(token, { documentType: documents.find((item) => item.id === documentId)?.name ?? 'Other', fileMetadata: { originalName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size } }).then((saved) => { setDocuments((current) => current.map((item) => item.id === documentId ? { ...item, serverId: saved.id } : item)); setMessage('Document metadata saved. The file itself was not uploaded because external file storage is not configured.') }).catch((cause: unknown) => { setDocuments((current) => current.map((item) => item.id === documentId ? { ...item, status: 'pending', file: null, previewUrl: '' } : item)); setUploadError({ id: documentId, message: cause instanceof Error ? cause.message : 'Document metadata could not be saved.' }) })
  }

  const handleRemove = () => {
    if (!removeTarget) return
    if (token && removeTarget.serverId) void deleteDocument(token, removeTarget.serverId).catch(() => setMessage('Could not remove the saved document metadata.'))
    setDocuments((current) => current.map((document) => document.id === removeTarget.id ? { ...document, status: document.mandatory ? 'required' : 'pending', file: null, previewUrl: '', serverId: undefined } : document))
    if (removeTarget.previewUrl) { URL.revokeObjectURL(removeTarget.previewUrl); previewUrls.current.delete(removeTarget.previewUrl) }
    setRemoveTarget(null)
    setMessage('Document removed from temporary browser preview.')
  }

  return <DashboardLayout><motion.div className="documents-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
    <header className="documents-page-header"><div><div className="documents-breadcrumb"><Link to="/citizen/dashboard">Dashboard</Link><ChevronRight size={14} /><span>My Documents</span></div><p className="dashboard-kicker">VISIT PREPARATION</p><h1>My Documents</h1><p>Manage your documents for a smoother hospital visit.</p></div><span className="documents-demo-badge"><ShieldCheck size={16} /> Temporary browser preview</span></header>
    {message && <div className="documents-message" role="status"><CheckCircle2 size={17} /><span>{message}</span><button type="button" aria-label="Dismiss message" onClick={() => setMessage('')}><X size={15} /></button></div>}
    {upcomingRequirements && <AppointmentReminder appointment={upcomingRequirements.appointment} missingDocumentIds={missingAppointmentDocuments} documents={documents} />}
    <section className="document-summary-grid" aria-label="Document overview"><SummaryCard label="Total documents" value={counts.total} tone="blue" icon={<FileText size={19} />} /><SummaryCard label="Uploaded documents" value={counts.uploaded} tone="green" icon={<FileCheck2 size={19} />} /><SummaryCard label="Pending documents" value={counts.pending} tone="orange" icon={<CircleHelp size={19} />} /><SummaryCard label="Required documents" value={counts.required} tone="red" icon={<AlertCircle size={19} />} /></section>
    <section className="document-list-section"><div className="document-list-heading"><div><p className="dashboard-kicker">YOUR FILES</p><h2>Document checklist</h2></div><span>{counts.uploaded} of {counts.total} uploaded</span></div><DocumentGroup title="Identity documents" description="Documents used to confirm your identity." documents={identityDocuments} uploadError={uploadError} onFileChange={handleFileChange} onRemove={setRemoveTarget} /><DocumentGroup title="Medical documents" description="Helpful records for your care team and visit preparation." documents={medicalDocuments} uploadError={uploadError} onFileChange={handleFileChange} onRemove={setRemoveTarget} /></section>
    <section className="documents-info-grid"><div className="documents-info-card"><div className="documents-info-icon"><Info size={19} /></div><div><h2>Upload guidance</h2><ul><li>Accepted formats: PDF, JPG, JPEG and PNG.</li><li>Maximum file size: 5 MB per document.</li><li>Upload clear and readable copies.</li><li>Do not upload unnecessary sensitive information.</li></ul></div></div><div className="documents-info-card documents-info-card--note"><div className="documents-info-icon"><ShieldCheck size={19} /></div><div><h2>File storage status</h2><p>Files stay in this browser session only. SmartQueue AI does not send them to a server or claim that a hospital has verified them.</p></div></div></section>
    <div className="documents-bottom-actions"><Link className="button button--secondary" to="/citizen/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link><Link className="button button--primary" to="/citizen/appointments">View Appointments <ArrowRight size={16} /></Link></div>
    {removeTarget && <RemoveConfirmation document={removeTarget} onCancel={() => setRemoveTarget(null)} onConfirm={handleRemove} />}
  </motion.div></DashboardLayout>
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: ReactNode }) {
  return <article className="document-summary-card"><span className={`document-summary-icon document-summary-icon--${tone}`}>{icon}</span><span><small>{label}</small><strong>{value}</strong></span></article>
}

function DocumentGroup({ title, description, documents, uploadError, onFileChange, onRemove }: { title: string; description: string; documents: DocumentItem[]; uploadError: { id: string; message: string } | null; onFileChange: (event: ChangeEvent<HTMLInputElement>, id: string) => void; onRemove: (document: DocumentItem) => void }) {
  return <section className="document-group"><div className="document-group-heading"><div><h2>{title}</h2><p>{description}</p></div><span>{documents.length} documents</span></div><div className="document-cards">{documents.map((document) => <DocumentCard key={document.id} document={document} error={uploadError?.id === document.id ? uploadError.message : ''} onFileChange={onFileChange} onRemove={onRemove} />)}</div></section>
}

function DocumentCard({ document, error, onFileChange, onRemove }: { document: DocumentItem; error: string; onFileChange: (event: ChangeEvent<HTMLInputElement>, id: string) => void; onRemove: (document: DocumentItem) => void }) {
  const isImage = Boolean(document.file?.type.startsWith('image/') && document.previewUrl)
  return <article className={`document-card document-card--${document.status}`}><div className="document-card-top"><span className="document-type-icon">{isImage ? <FileImage size={20} /> : <FileText size={20} />}</span><div className="document-card-title"><div><h3>{document.name}</h3><span className={`document-status document-status--${document.status}`}><span /> {statusLabel(document.status)}</span></div><p>{document.mandatory ? 'Mandatory document' : 'Optional document'}</p></div></div><p className="document-description">{document.description}</p>{document.status === 'rejected' && <p className="document-rejected-note"><AlertCircle size={14} /> {document.rejectedReason ?? 'This file needs attention before it can be accepted.'}</p>}{document.file ? <div className="document-file-preview">{isImage ? <img src={document.previewUrl} alt={`Preview of ${document.name}`} /> : <span className="document-pdf-preview"><FileText size={22} /><small>PDF</small></span>}<div><strong>{document.file.name}</strong><small>{formatDocumentSize(document.file.size)} · Temporary preview</small></div></div> : <div className="document-empty-file"><Upload size={18} /><span>No file uploaded yet</span></div>}<div className="document-card-footer"><span className="document-hint">{document.acceptedHint}</span><div className="document-card-actions"><label className="button button--secondary document-upload-button" htmlFor={`document-upload-${document.id}`}><Upload size={15} /> {document.file ? 'Replace' : 'Upload'}<input id={`document-upload-${document.id}`} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => onFileChange(event, document.id)} /></label>{document.file && <button className="document-remove-button" type="button" onClick={() => onRemove(document)}><X size={14} /> Remove</button>}</div></div>{error && <p className="document-upload-error" role="alert"><AlertCircle size={14} /> {error}</p>}</article>
}

function AppointmentReminder({ appointment, missingDocumentIds, documents }: { appointment: Appointment; missingDocumentIds: string[]; documents: DocumentItem[] }) {
  if (!appointment) return null
  return <section className={`appointment-document-reminder ${missingDocumentIds.length ? 'appointment-document-reminder--warning' : 'appointment-document-reminder--ready'}`}><span className="appointment-reminder-icon">{missingDocumentIds.length ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}</span><div><p className="dashboard-kicker">UPCOMING APPOINTMENT</p><h2>{appointment.department} · {formatBookingDate(appointment.date)}</h2><p>{missingDocumentIds.length ? `You have ${missingDocumentIds.length} document${missingDocumentIds.length === 1 ? '' : 's'} to prepare before this appointment.` : 'Your document checklist is ready for this appointment.'}</p><div className="appointment-required-list">{appointmentRequiredNames(missingDocumentIds, documents).map((name) => <span key={name}><span className="reminder-dot" /> {name}</span>)}</div></div><Link className="appointment-reminder-link" to="/citizen/appointments">View appointment <ArrowRight size={15} /></Link></section>
}

function appointmentRequiredNames(ids: string[], documents: DocumentItem[]) {
  return ids.length ? ids.map((id) => documents.find((document) => document.id === id)?.name ?? id) : ['All required documents uploaded']
}

function statusLabel(status: DocumentStatus) { return status === 'required' ? 'Required' : status[0].toUpperCase() + status.slice(1) }

function RemoveConfirmation({ document, onCancel, onConfirm }: { document: DocumentItem; onCancel: () => void; onConfirm: () => void }) {
  return <div className="document-confirm-backdrop"><section className="document-confirm" role="alertdialog" aria-modal="true" aria-labelledby="remove-document-title"><span className="document-confirm-icon"><AlertCircle size={22} /></span><h2 id="remove-document-title">Remove {document.name}?</h2><p>This only removes the temporary browser preview. The file itself is not uploaded; only its metadata is saved. Removing it deletes only the saved metadata and local preview.</p><div><button className="button button--secondary" type="button" onClick={onCancel}>Keep document</button><button className="button button--danger" type="button" onClick={onConfirm}>Yes, remove</button></div></section></div>
}
