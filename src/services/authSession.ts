import type { AuthApiUser, AuthSessionResponse } from '../types/authApi'
const key = 'smartqueue.session'
type StoredSession = { user: AuthApiUser; accessToken: string; persistent?: boolean }
export function readSession(): StoredSession | null { for (const storage of [localStorage, sessionStorage]) { const raw = storage.getItem(key); if (!raw) continue; try { return JSON.parse(raw) as StoredSession } catch { storage.removeItem(key) } } return null }
export function setSession(value: Pick<AuthSessionResponse, 'user' | 'accessToken'>, persistent: boolean) { const storage = persistent ? localStorage : sessionStorage; const other = persistent ? sessionStorage : localStorage; storage.setItem(key, JSON.stringify({ ...value, persistent })); other.removeItem(key) }
export function clearSession() { localStorage.removeItem(key); sessionStorage.removeItem(key) }
export function getAccessToken() { return readSession()?.accessToken }
