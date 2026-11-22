import type { RequestHandler } from 'express'
import { CitizenError, type CitizenService } from '../services/citizenService.ts'
import {
  createAppointmentSchema,
  createDocumentSchema,
  createTokenSchema,
  notificationPageQuerySchema,
  pageQuerySchema,
  patchAppointmentSchema,
  profilePatchSchema,
} from '../services/citizenValidation.ts'

export function createCitizenController(service: CitizenService) {
  const getProfile: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { profile: await service.getProfile(userId(request)) } }) } catch (error) { next(error) }
  }

  const updateProfile: RequestHandler = async (request, response, next) => {
    const parsed = profilePatchSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ status: 'error', message: 'Profile update is invalid.', errors: validationErrors(parsed.error.issues) })
      return
    }
    try { response.json({ status: 'success', data: { profile: await service.updateProfile(userId(request), parsed.data) } }) } catch (error) { next(error) }
  }

  const listDepartments: RequestHandler = async (_request, response, next) => {
    try { response.json({ status: 'success', data: { departments: await service.listDepartments() } }) } catch (error) { next(error) }
  }
  const getDepartment: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { department: await service.getDepartment(paramId(request)) } }) } catch (error) { next(error) }
  }

  const createToken: RequestHandler = async (request, response, next) => {
    const parsed = createTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ status: 'error', message: 'Token booking details are invalid.', errors: validationErrors(parsed.error.issues) })
      return
    }
    try { response.status(201).json({ status: 'success', data: { token: await service.createToken(userId(request), parsed.data) } }) } catch (error) { next(error) }
  }
  const listTokens: RequestHandler = async (request, response, next) => {
    const parsed = pageQuerySchema.safeParse(request.query)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Pagination parameters are invalid.' }); return }
    try { response.json({ status: 'success', data: await service.listMyTokens(userId(request), parsed.data) }) } catch (error) { next(error) }
  }
  const getToken: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { token: await service.getMyToken(userId(request), paramId(request)) } }) } catch (error) { next(error) }
  }
  const cancelToken: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { token: await service.cancelToken(userId(request), paramId(request)) } }) } catch (error) { next(error) }
  }
  const trackToken: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { tracking: await service.trackToken(userId(request), paramId(request)) } }) } catch (error) { next(error) }
  }

  const createAppointment: RequestHandler = async (request, response, next) => {
    const parsed = createAppointmentSchema.safeParse(request.body)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Appointment details are invalid.', errors: validationErrors(parsed.error.issues) }); return }
    try { response.status(201).json({ status: 'success', data: { appointment: await service.createAppointment(userId(request), parsed.data) } }) } catch (error) { next(error) }
  }
  const listAppointments: RequestHandler = async (request, response, next) => {
    const parsed = pageQuerySchema.safeParse(request.query)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Pagination parameters are invalid.' }); return }
    try { response.json({ status: 'success', data: await service.listMyAppointments(userId(request), parsed.data) }) } catch (error) { next(error) }
  }
  const getAppointment: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { appointment: await service.getMyAppointment(userId(request), paramId(request)) } }) } catch (error) { next(error) }
  }
  const updateAppointment: RequestHandler = async (request, response, next) => {
    const parsed = patchAppointmentSchema.safeParse(request.body)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Appointment update is invalid.', errors: validationErrors(parsed.error.issues) }); return }
    try { response.json({ status: 'success', data: { appointment: await service.updateAppointment(userId(request), paramId(request), parsed.data) } }) } catch (error) { next(error) }
  }
  const cancelAppointment: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { appointment: await service.cancelAppointment(userId(request), paramId(request)) } }) } catch (error) { next(error) }
  }

  const createDocument: RequestHandler = async (request, response, next) => {
    const parsed = createDocumentSchema.safeParse(request.body)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Document metadata is invalid.', errors: validationErrors(parsed.error.issues) }); return }
    try { response.status(201).json({ status: 'success', data: { document: await service.createDocument(userId(request), parsed.data) } }) } catch (error) { next(error) }
  }
  const listDocuments: RequestHandler = async (request, response, next) => {
    const parsed = pageQuerySchema.safeParse(request.query)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Pagination parameters are invalid.' }); return }
    try { response.json({ status: 'success', data: await service.listMyDocuments(userId(request), parsed.data) }) } catch (error) { next(error) }
  }
  const deleteDocument: RequestHandler = async (request, response, next) => {
    try { await service.deleteDocument(userId(request), paramId(request)); response.status(204).end() } catch (error) { next(error) }
  }

  const listNotifications: RequestHandler = async (request, response, next) => {
    const parsed = notificationPageQuerySchema.safeParse(request.query)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Pagination parameters are invalid.' }); return }
    try { response.json({ status: 'success', data: await service.listMyNotifications(userId(request), parsed.data, parsed.data.unreadOnly === 'true') }) } catch (error) { next(error) }
  }
  const markNotificationRead: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { notification: await service.markNotificationRead(userId(request), paramId(request)) } }) } catch (error) { next(error) }
  }
  const markAllNotificationsRead: RequestHandler = async (request, response, next) => {
    try { response.json({ status: 'success', data: { modifiedCount: await service.markAllNotificationsRead(userId(request)) } }) } catch (error) { next(error) }
  }

  return {
    getProfile, updateProfile, listDepartments, getDepartment, createToken, listTokens, getToken, cancelToken, trackToken,
    createAppointment, listAppointments, getAppointment, updateAppointment, cancelAppointment,
    createDocument, listDocuments, deleteDocument, listNotifications, markNotificationRead, markAllNotificationsRead,
  }
}

function userId(request: Parameters<RequestHandler>[0]) {
  if (!request.auth || request.auth.role !== 'citizen') throw new CitizenError('Citizen authentication is required.', 401)
  return request.auth.userId
}

function paramId(request: Parameters<RequestHandler>[0]) {
  const id = request.params.id
  if (typeof id !== 'string') throw new CitizenError('The requested ID is invalid.', 400)
  return id
}

function validationErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return issues.map((issue) => ({ field: issue.path.map(String).join('.'), message: issue.message }))
}
