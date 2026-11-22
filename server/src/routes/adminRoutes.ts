import { Router, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { env } from '../config/env.ts'
import { createAdminController } from '../controllers/adminController.ts'
import { createAuthenticationMiddleware, requireAdmin } from '../middleware/auth.ts'
import { AdminService, adminService } from '../services/adminService.ts'

export function createAdminRouter(service: AdminService = adminService, authenticate: RequestHandler = createAuthenticationMiddleware()) {
  const router = Router(); const c = createAdminController(service)
  const aiInsightLimiter = rateLimit({ windowMs: env.geminiRateLimitWindowMs, limit: env.geminiRateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false, message: { status: 'error', message: 'AI insight requests are temporarily rate limited. Try again shortly.' } })
  router.use(authenticate, requireAdmin)
  router.get('/dashboard', c.dashboard); router.get('/dashboard/metrics', c.metrics); router.get('/dashboard/recent-activity', c.activity)
  router.post('/walk-in-patients', c.registerWalkIn)
  router.get('/tokens', c.tokens); router.get('/tokens/:id', c.token); router.patch('/tokens/:id/status', c.tokenStatus); router.post('/tokens/:id/call', c.callToken); router.post('/tokens/:id/skip', c.skipToken); router.post('/tokens/:id/complete', c.completeToken); router.post('/tokens/:id/cancel', c.cancelToken)
  router.get('/appointments', c.appointments); router.get('/appointments/:id', c.appointment); router.patch('/appointments/:id/status', c.appointmentStatus); router.post('/appointments/:id/approve', c.approveAppointment); router.post('/appointments/:id/reschedule', c.reschedule); router.post('/appointments/:id/cancel', c.cancelAppointment); router.post('/appointments/:id/complete', c.completeAppointment)
  router.get('/departments', c.departments); router.post('/departments', c.createDepartment); router.get('/departments/:id', c.department); router.patch('/departments/:id', c.patchDepartment); router.delete('/departments/:id', c.deleteDepartment)
  router.get('/counters', c.counters); router.post('/counters', c.createCounter); router.get('/counters/:id', c.counter); router.patch('/counters/:id', c.patchCounter); router.patch('/counters/:id/status', c.counterStatus); router.delete('/counters/:id', c.deleteCounter)
  router.get('/queues', c.queues); router.get('/queues/:departmentId', c.queue); router.patch('/queues/:departmentId', c.updateQueueSettings); router.post('/queues/:departmentId/call-next', c.callNext)
  router.get('/reports/overview', c.reports); router.get('/reports/queues', c.reportQueues); router.get('/reports/departments', c.reportDepartments); router.get('/reports/waiting-times', c.reportWaitingTimes); router.get('/reports/appointments', c.reportAppointments)
  router.use('/ai-insights', aiInsightLimiter)
  router.get('/ai-insights/overview', c.insights); router.get('/ai-insights/peak-hours', c.insights); router.get('/ai-insights/department-performance', c.insights); router.get('/ai-insights/wait-time-analysis', c.insights); router.get('/ai-insights/recommendations', c.insights); router.post('/ai-insights/refresh', c.refreshInsights)
  router.get('/settings', c.settings); router.patch('/settings', c.updateSettings); router.get('/activity', c.activity)
  router.get('/profile', c.profile); router.patch('/profile', c.updateProfile)
  router.get('/notification-preferences', c.notificationPreferences); router.patch('/notification-preferences', c.updateNotificationPreferences)
  return router
}
export const adminRouter = createAdminRouter()
