import { clearSession, getAccessToken } from '../authSession'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  let response: Response
  let sentToken: string | undefined
  try {
    const headers = new Headers(init.headers)
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    sentToken = accessToken ?? getAccessToken()
    if (sentToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${sentToken}`)
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch { throw new ApiError('Unable to reach SmartQueue AI. Check your connection and try again.', 0) }
  const payload = await response.json().catch(() => null) as { message?: string; data?: T } | null
  if (response.status === 401 && sentToken) { clearSession(); window.dispatchEvent(new Event('smartqueue:unauthorized')) }
  if (!response.ok) throw new ApiError(payload?.message ?? 'The API could not complete the request.', response.status)
  if (!payload) return undefined as T
  return (payload.data ?? payload) as T
}
