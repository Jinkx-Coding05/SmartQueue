import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, logout as logoutRequest } from '../services/api/authApi'
import { setSession, clearSession, readSession } from '../services/authSession'
import { AuthContext } from './auth-context'
import type { AuthSessionResponse } from '../types/authApi'
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setCurrentSession] = useState(() => readSession())
  const [loading, setLoading] = useState(Boolean(readSession()?.accessToken))
  const signIn = useCallback((next: AuthSessionResponse, remember: boolean) => { setSession(next, remember); setCurrentSession({ user: next.user, accessToken: next.accessToken }) }, [])
  const refreshUser = useCallback(async () => { const current = readSession(); if (!current?.accessToken) { setCurrentSession(null); return } try { const result = await getCurrentUser(current.accessToken); setSession({ ...current, user: result.user }, current.persistent ?? false); setCurrentSession({ ...current, user: result.user }) } catch { clearSession(); setCurrentSession(null) } }, [])
  const signOut = useCallback(async () => { const current = readSession(); clearSession(); setCurrentSession(null); if (current?.accessToken) { try { await logoutRequest(current.accessToken) } catch { /* Local token removal is sufficient if the server is unavailable. */ } } }, [])
  useEffect(() => { let active = true; const current = readSession(); if (current?.accessToken) { getCurrentUser(current.accessToken).then(({ user }) => { if (active) { setSession({ ...current, user }, current.persistent ?? false); setCurrentSession({ ...current, user }) } }).catch(() => { if (active) { clearSession(); setCurrentSession(null) } }).finally(() => { if (active) setLoading(false) }) } const unauthorized = () => { clearSession(); setCurrentSession(null); setLoading(false) }; window.addEventListener('smartqueue:unauthorized', unauthorized); return () => { active = false; window.removeEventListener('smartqueue:unauthorized', unauthorized) } }, [])
  const value = useMemo(() => ({ user: session?.user ?? null, token: session?.accessToken ?? null, loading, signIn, refreshUser, signOut }), [session, loading, signIn, refreshUser, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
