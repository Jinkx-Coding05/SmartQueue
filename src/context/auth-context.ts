import { createContext } from 'react'
import type { AuthApiUser, AuthSessionResponse } from '../types/authApi'

export type AuthContextValue = {
  user: AuthApiUser | null
  token: string | null
  loading: boolean
  signIn: (session: AuthSessionResponse, remember: boolean) => void
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
