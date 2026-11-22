export type ApiPagination = { page: number; limit: number; total: number; pages: number }
export type Paginated<T> = { items: T[]; pagination: ApiPagination }
export type CitizenProfileApi = {
  id: string; fullName: string; email: string; phoneNumber: string; dateOfBirth: string; gender: string; profileImage: string
  address: { address?: string; city?: string; state?: string; pinCode?: string }; accountStatus: string; createdAt: string
}
export type CitizenProfilePatch = Partial<Pick<CitizenProfileApi, 'fullName' | 'phoneNumber' | 'dateOfBirth' | 'gender' | 'profileImage'>> & {
  address?: Partial<CitizenProfileApi['address']>
}
export type DepartmentApi = {
  id: string; name: string; description: string; workingHours: Array<{ day: string; opensAt: string; closesAt: string; isClosed: boolean }>
  activeCounterCount: number; available: boolean
}
export type CitizenTokenApi = {
  id: string; tokenNumber: string; department: Pick<DepartmentApi, 'id' | 'name'>; assignedCounter: { id: string; name?: string } | null
  status: 'waiting' | 'serving' | 'completed' | 'skipped' | 'cancelled'; bookingDate: string; estimatedWaitingTime: number; preferredVisitDate?: string | null; preferredTime?: string | null; visitType?: string | null; createdAt: string; updatedAt: string
}
export type TokenTrackingApi = {
  id: string; tokenNumber: string; status: CitizenTokenApi['status']; queuePosition: number | null; patientsAhead: number | null
  department: Pick<DepartmentApi, 'id' | 'name'>; assignedCounter: { id: string; name?: string } | null
  currentlyServingToken: string | null; estimatedWaitingTime: number | null; estimatedArrivalAt: string | null; preferredVisitDate?: string | null; preferredTime?: string | null; visitType?: string | null; lastUpdatedAt: string
  estimatedServiceDurationMinutes?: number | null; serviceDurationSource?: 'historical' | 'default' | null; arrivalBufferMinutes?: number; totalArrivalAllowanceMinutes?: number | null; suggestedArrivalAt?: string | null
}
export type CitizenAppointmentApi = {
  id: string; appointmentId: string; department: Pick<DepartmentApi, 'id' | 'name'>; appointmentDate: string; appointmentTime: string
  status: 'pending' | 'approved' | 'rescheduled' | 'completed' | 'cancelled'; notes: string; createdAt: string; updatedAt: string
}
export type CitizenDocumentApi = {
  id: string; documentType: string; fileMetadata: { originalName: string; mimeType: string; sizeBytes: number }
  verificationStatus: 'pending' | 'verified' | 'rejected'; storageStatus: 'metadata-only' | 'stored'; storageMessage: string; uploadDate: string
}
export type CitizenNotificationApi = { id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string }
