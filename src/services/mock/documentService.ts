import { getAppointments } from './appointmentService'

export type DocumentCategory = 'identity' | 'medical'
export type DocumentStatus = 'required' | 'pending' | 'uploaded' | 'rejected'

export type DocumentDefinition = {
  id: string
  name: string
  category: DocumentCategory
  mandatory: boolean
  description: string
  acceptedHint: string
  status: DocumentStatus
  rejectedReason?: string
}

export const documentDefinitions: DocumentDefinition[] = [
  { id: 'government-id', name: 'Government ID', category: 'identity', mandatory: true, description: 'Aadhaar, passport, driving licence or another valid government ID.', acceptedHint: 'Required for every visit.', status: 'required' },
  { id: 'address-proof', name: 'Address Proof', category: 'identity', mandatory: false, description: 'A recent utility bill, voter ID or other address document.', acceptedHint: 'Replace with a clearer copy if needed.', status: 'rejected', rejectedReason: 'Demo review: upload a clearer, readable copy if this document is requested.' },
  { id: 'previous-reports', name: 'Previous Medical Reports', category: 'medical', mandatory: false, description: 'Recent reports that can help the care team understand your history.', acceptedHint: 'Recommended for follow-up visits.', status: 'pending' },
  { id: 'prescription', name: 'Prescription', category: 'medical', mandatory: false, description: 'Your current prescription or medication list.', acceptedHint: 'Optional, but useful for medication reviews.', status: 'pending' },
  { id: 'referral-letter', name: 'Referral Letter', category: 'medical', mandatory: false, description: 'A referral from another provider, if your service requires one.', acceptedHint: 'Bring if applicable to your visit.', status: 'pending' },
  { id: 'medical-history', name: 'Medical History', category: 'medical', mandatory: false, description: 'A concise history of relevant conditions or procedures.', acceptedHint: 'Optional preparation document.', status: 'pending' },
]

export function getUpcomingAppointmentRequirements() {
  const appointment = getAppointments().find((item) => item.status === 'upcoming')
  if (!appointment) return null

  const requiredDocumentIds = ['government-id', ...(appointment.visitType === 'Follow-up' ? ['previous-reports'] : []), ...(appointment.visitType === 'New Consultation' ? ['referral-letter'] : [])]
  return { appointment, requiredDocumentIds }
}

export function formatDocumentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isAcceptedDocument(file: File) {
  const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png']
  const acceptedExtensions = ['.pdf', '.jpg', '.jpeg', '.png']
  const lowerName = file.name.toLowerCase()
  return acceptedTypes.includes(file.type) || acceptedExtensions.some((extension) => lowerName.endsWith(extension))
}
