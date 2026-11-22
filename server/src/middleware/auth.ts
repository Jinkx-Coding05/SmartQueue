import type { RequestHandler } from 'express'
import type { UserRole } from '../models/sharedEnums.ts'
import { AuthError, type AuthService } from '../services/authService.ts'
import { authService } from '../services/authService.ts'

export function createAuthenticationMiddleware(service: AuthService = authService): RequestHandler {
  return async (request, response, next) => {
    const authorization = request.header('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      response.status(401).json({ status: 'error', message: 'Authentication is required.' })
      return
    }
    const token = authorization.slice(7).trim()
    if (!token || token.length > 4096) {
      response.status(401).json({ status: 'error', message: 'Authentication token is invalid or expired.' })
      return
    }
    try {
      const context = await service.authenticate(token)
      request.auth = context
      request.user = context.user
      next()
    } catch (error) {
      if (error instanceof AuthError && error.statusCode === 401) {
        response.status(401).json({ status: 'error', message: error.message })
        return
      }
      next(error)
    }
  }
}

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (request, response, next) => {
    if (!request.auth) {
      response.status(401).json({ status: 'error', message: 'Authentication is required.' })
      return
    }
    if (!allowedRoles.includes(request.auth.role)) {
      response.status(403).json({ status: 'error', message: 'You do not have permission to access this resource.' })
      return
    }
    next()
  }
}

export const requireCitizen = requireRole('citizen')
export const requireAdmin = requireRole('admin')
