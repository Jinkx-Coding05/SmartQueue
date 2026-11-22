import { useContext } from 'react'
import { AuthContext } from './auth-context'
import type { AuthApiUser } from '../types/authApi'

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export type { AuthApiUser }
