import type {
  CitizenAppointmentApi,
  CitizenDocumentApi,
  CitizenNotificationApi,
  CitizenProfileApi,
  CitizenProfilePatch,
  CitizenTokenApi,
  DepartmentApi,
  Paginated,
  TokenTrackingApi,
} from '../../types/citizenApi'
import { apiRequest } from './http'

export type PageOptions = { page?: number; limit?: number }
const paginationQuery = (options: PageOptions = {}) => new URLSearchParams({ page: String(options.page ?? 1), limit: String(options.limit ?? 20) }).toString()

export async function getCitizenProfile(token: string): Promise<CitizenProfileApi> {
  return (await apiRequest<{ profile: CitizenProfileApi }>('/citizen/profile', { method: 'GET' }, token)).profile
}

export async function updateCitizenProfile(token: string, patch: CitizenProfilePatch): Promise<CitizenProfileApi> {
  return (await apiRequest<{ profile: CitizenProfileApi }>('/citizen/profile', { method: 'PATCH', body: JSON.stringify(patch) }, token)).profile
}

export async function getDepartments(): Promise<DepartmentApi[]> {
  return (await apiRequest<{ departments: DepartmentApi[] }>('/departments')).departments
}

export async function getDepartment(id: string): Promise<DepartmentApi> {
  return (await apiRequest<{ department: DepartmentApi }>(`/departments/${encodeURIComponent(id)}`)).department
}

export async function bookToken(token: string, input: { departmentId: string; preferredVisitDate?: string; preferredTime?: string; visitType?: string }): Promise<CitizenTokenApi> {
  return (await apiRequest<{ token: CitizenTokenApi }>('/tokens', { method: 'POST', body: JSON.stringify(input) }, token)).token
}

export function getMyTokens(token: string, page?: PageOptions): Promise<Paginated<CitizenTokenApi>> {
  return apiRequest(`/tokens/my?${paginationQuery(page)}`, { method: 'GET' }, token)
}

export async function getMyToken(token: string, id: string): Promise<CitizenTokenApi> {
  return (await apiRequest<{ token: CitizenTokenApi }>(`/tokens/${encodeURIComponent(id)}`, { method: 'GET' }, token)).token
}

export async function cancelToken(token: string, id: string): Promise<CitizenTokenApi> {
  return (await apiRequest<{ token: CitizenTokenApi }>(`/tokens/${encodeURIComponent(id)}/cancel`, { method: 'POST' }, token)).token
}

export async function trackToken(token: string, id: string): Promise<TokenTrackingApi> {
  return (await apiRequest<{ tracking: TokenTrackingApi }>(`/tokens/${encodeURIComponent(id)}/tracking`, { method: 'GET' }, token)).tracking
}

export async function createAppointment(token: string, input: { departmentId: string; appointmentDate: string; appointmentTime: string; notes?: string }): Promise<CitizenAppointmentApi> {
  return (await apiRequest<{ appointment: CitizenAppointmentApi }>('/appointments', { method: 'POST', body: JSON.stringify(input) }, token)).appointment
}

export function getMyAppointments(token: string, page?: PageOptions): Promise<Paginated<CitizenAppointmentApi>> {
  return apiRequest(`/appointments/my?${paginationQuery(page)}`, { method: 'GET' }, token)
}

export async function getMyAppointment(token: string, id: string): Promise<CitizenAppointmentApi> {
  return (await apiRequest<{ appointment: CitizenAppointmentApi }>(`/appointments/${encodeURIComponent(id)}`, { method: 'GET' }, token)).appointment
}

export async function updateAppointment(token: string, id: string, patch: { appointmentDate?: string; appointmentTime?: string; notes?: string }): Promise<CitizenAppointmentApi> {
  return (await apiRequest<{ appointment: CitizenAppointmentApi }>(`/appointments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }, token)).appointment
}

export async function cancelAppointment(token: string, id: string): Promise<CitizenAppointmentApi> {
  return (await apiRequest<{ appointment: CitizenAppointmentApi }>(`/appointments/${encodeURIComponent(id)}/cancel`, { method: 'POST' }, token)).appointment
}

export async function createDocument(token: string, input: { documentType: string; fileMetadata: { originalName: string; mimeType: string; sizeBytes: number } }): Promise<CitizenDocumentApi> {
  return (await apiRequest<{ document: CitizenDocumentApi }>('/documents', { method: 'POST', body: JSON.stringify(input) }, token)).document
}

export function getMyDocuments(token: string, page?: PageOptions): Promise<Paginated<CitizenDocumentApi>> {
  return apiRequest(`/documents/my?${paginationQuery(page)}`, { method: 'GET' }, token)
}

export function deleteDocument(token: string, id: string): Promise<void> {
  return apiRequest(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }, token)
}

export function getMyNotifications(token: string, page?: PageOptions & { unreadOnly?: boolean }): Promise<Paginated<CitizenNotificationApi>> {
  const query = new URLSearchParams(paginationQuery(page))
  if (page?.unreadOnly !== undefined) query.set('unreadOnly', String(page.unreadOnly))
  return apiRequest(`/notifications/my?${query.toString()}`, { method: 'GET' }, token)
}

export async function markNotificationRead(token: string, id: string): Promise<CitizenNotificationApi> {
  return (await apiRequest<{ notification: CitizenNotificationApi }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }, token)).notification
}

export function markAllNotificationsRead(token: string): Promise<{ modifiedCount: number }> {
  return apiRequest('/notifications/read-all', { method: 'PATCH' }, token)
}
