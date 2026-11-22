import type { SafeUser, AuthContext } from '../services/authService.ts'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
      user?: SafeUser
    }
  }
}

export {}
