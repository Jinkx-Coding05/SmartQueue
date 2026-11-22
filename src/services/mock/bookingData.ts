export type ServiceCenter = {
  id: string
  name: string
  location: string
  services: string[]
}

export type BookingDocument = {
  id: string
  label: string
  note: string
  required: boolean
}

export const serviceCenters: ServiceCenter[] = [
  { id: 'city-general', name: 'City General Hospital', location: 'Central Avenue, Downtown', services: ['Outpatient care', 'Diagnostics', 'Vaccination'] },
  { id: 'community-health', name: 'Community Health Hub', location: 'Westside Community District', services: ['Primary care', 'Vaccination', 'Wellness checks'] },
  { id: 'civic-services', name: 'Civic Services Center', location: 'Municipal Plaza, East Wing', services: ['Citizen help desk', 'Document verification', 'Public health services'] },
]

export const departments = ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Dermatology', 'Ophthalmology']
export const visitTypes = ['New Consultation', 'Follow-up', 'Emergency']

export const timeSlots = [
  { value: '09:00', label: '09:00 AM', available: true },
  { value: '09:30', label: '09:30 AM', available: true },
  { value: '10:00', label: '10:00 AM', available: false },
  { value: '10:30', label: '10:30 AM', available: true },
  { value: '11:00', label: '11:00 AM', available: true },
  { value: '11:30', label: '11:30 AM', available: false },
  { value: '02:00', label: '02:00 PM', available: true },
  { value: '02:30', label: '02:30 PM', available: true },
  { value: '03:00', label: '03:00 PM', available: true },
  { value: '03:30', label: '03:30 PM', available: false },
]

export function getBookingDocuments(visitType: string): BookingDocument[] {
  return [
    { id: 'government-id', label: 'Government ID', note: 'Required for every visit', required: true },
    { id: 'previous-reports', label: 'Previous medical reports', note: visitType === 'Follow-up' ? 'Recommended for follow-up visits' : 'Bring if applicable', required: false },
    { id: 'appointment-referral', label: 'Appointment referral', note: visitType === 'New Consultation' ? 'Bring if your service requires one' : 'Bring if applicable', required: false },
  ]
}

export function formatBookingDate(date: string) {
  if (!date) return 'Not selected'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

export function getNextAvailableDate(offset = 1) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
