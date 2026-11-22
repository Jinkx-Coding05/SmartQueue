import { Router, type RequestHandler } from 'express'
import { createCitizenController } from '../controllers/citizenController.ts'
import { createAuthenticationMiddleware, requireCitizen } from '../middleware/auth.ts'
import { citizenService, type CitizenService } from '../services/citizenService.ts'

export function createDepartmentRouter(service: CitizenService = citizenService) {
  const router = Router()
  const controller = createCitizenController(service)
  router.get('/', controller.listDepartments)
  router.get('/:id', controller.getDepartment)
  return router
}

export function createCitizenRouter(service: CitizenService = citizenService, authenticate: RequestHandler = createAuthenticationMiddleware()) {
  const router = Router()
  const controller = createCitizenController(service)
  const protect = [authenticate, requireCitizen] as const

  router.get('/citizen/profile', ...protect, controller.getProfile)
  router.patch('/citizen/profile', ...protect, controller.updateProfile)

  router.post('/tokens', ...protect, controller.createToken)
  router.get('/tokens/my', ...protect, controller.listTokens)
  router.get('/tokens/:id/tracking', ...protect, controller.trackToken)
  router.post('/tokens/:id/cancel', ...protect, controller.cancelToken)
  router.get('/tokens/:id', ...protect, controller.getToken)

  router.post('/appointments', ...protect, controller.createAppointment)
  router.get('/appointments/my', ...protect, controller.listAppointments)
  router.post('/appointments/:id/cancel', ...protect, controller.cancelAppointment)
  router.get('/appointments/:id', ...protect, controller.getAppointment)
  router.patch('/appointments/:id', ...protect, controller.updateAppointment)

  router.post('/documents', ...protect, controller.createDocument)
  router.get('/documents/my', ...protect, controller.listDocuments)
  router.delete('/documents/:id', ...protect, controller.deleteDocument)

  router.get('/notifications/my', ...protect, controller.listNotifications)
  router.patch('/notifications/read-all', ...protect, controller.markAllNotificationsRead)
  router.patch('/notifications/:id/read', ...protect, controller.markNotificationRead)

  return router
}

export const departmentRouter = createDepartmentRouter()
export const citizenRouter = createCitizenRouter()
