import { rateLimit } from 'express-rate-limit'
import { Router, type RequestHandler } from 'express'
import { env } from '../config/env.ts'
import { createAuthController } from '../controllers/authController.ts'
import { createAuthenticationMiddleware } from '../middleware/auth.ts'
import { authService, type AuthService } from '../services/authService.ts'

const authRateLimit = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  limit: env.authRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ status: 'error', message: 'Too many authentication requests. Try again later.' }),
})

export function createAuthRouter(service: AuthService = authService, rateLimiter: RequestHandler = authRateLimit) {
  const router = Router()
  const controller = createAuthController(service)
  const authenticate = createAuthenticationMiddleware(service)

  router.post('/register', rateLimiter, controller.register)
  router.post('/verify-otp', rateLimiter, controller.verifyEmail)
  router.post('/resend-otp', rateLimiter, controller.resendVerification)
  router.post('/login', rateLimiter, controller.login)
  router.get('/me', authenticate, controller.me)
  router.patch('/change-password', rateLimiter, authenticate, controller.changePassword)
  router.post('/logout', rateLimiter, authenticate, controller.logout)
  router.post('/forgot-password', rateLimiter, controller.forgotPassword)
  router.post('/reset-password', rateLimiter, controller.resetPassword)

  return router
}

export const authRouter = createAuthRouter()
