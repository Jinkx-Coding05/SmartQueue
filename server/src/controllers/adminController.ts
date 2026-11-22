import type { RequestHandler } from 'express'
import type { AdminService } from '../services/adminService.ts'
import * as v from '../services/adminValidation.ts'

export function createAdminController(service: AdminService) {
  const run = (fn: (request: any) => Promise<unknown>, status = 200): RequestHandler => async (request, response, next) => { const routeId = request.params.id ?? request.params.departmentId; if (routeId !== undefined && (typeof routeId !== 'string' || !/^[\da-f]{24}$/i.test(routeId))) { response.status(400).json({ status: 'error', message: 'A valid resource ID is required.' }); return } try { response.status(status).json({ status: 'success', data: await fn(request) }) } catch (error) { next(error) } }
  const validate = (schema: any, source: 'query' | 'body' = 'query') => (handler: (request: any, data: any) => Promise<unknown>, status = 200): RequestHandler => async (request, response, next) => {
    const routeId = request.params.id ?? request.params.departmentId; if (routeId !== undefined && (typeof routeId !== 'string' || !/^[\da-f]{24}$/i.test(routeId))) { response.status(400).json({ status: 'error', message: 'A valid resource ID is required.' }); return }
    const parsed = schema.safeParse(source === 'body' ? (request.body ?? {}) : request.query); if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Request validation failed.', errors: parsed.error.issues.map((i: any) => ({ field: i.path.join('.'), message: i.message })) }); return }
    try { response.status(status).json({ status: 'success', data: await handler(request, parsed.data) }) } catch (error) { next(error) }
  }
  const actor = (r: any) => String(r.auth.user.id)
  const param = (r: any) => String(r.params.id)
  const listTokens = validate(v.adminTokenQuerySchema)((_r, q) => service.listTokens(q))
  const listAppointments = validate(v.adminAppointmentQuerySchema)((_r, q) => service.listAppointments(q))
  const listDepartments = validate(v.adminDepartmentQuerySchema)((_r, q) => service.listDepartments(q))
  const listCounters = validate(v.adminCounterQuerySchema)((_r, q) => service.listCounters(q))
  const dateRange = validate(v.adminDateRangeQuerySchema)((_r, q) => service.reports(q.from, q.to, q.departmentId))
  const activityList = validate(v.activityQuerySchema)((_r, q) => service.activityList(q))
  const insights = validate(v.adminInsightQuerySchema)((_r, q) => service.insights(q.departmentId))
  const refreshInsights = validate(v.adminInsightQuerySchema, 'body')((_r, body) => service.refreshInsights(body.departmentId))
  const createDepartment = validate(v.departmentCreateSchema, 'body')((r, body) => service.createDepartment(actor(r), body), 201)
  const patchDepartment = validate(v.departmentPatchSchema, 'body')((r, body) => service.updateDepartment(actor(r), param(r), body))
  const createCounter = validate(v.counterCreateSchema, 'body')((r, body) => service.createCounter(actor(r), body), 201)
  const patchCounter = validate(v.counterPatchSchema, 'body')((r, body) => service.updateCounter(actor(r), param(r), body))
  const counterStatus = validate(v.counterStatusSchema, 'body')((r, body) => service.setCounterStatus(actor(r), param(r), body.status))
  const tokenStatus = validate(v.tokenStatusSchema, 'body')((r, body) => service.updateToken(actor(r), param(r), body.status, body.note))
  const callNext = validate(v.callTokenSchema, 'body')((r, body) => service.callNext(actor(r), String(r.params.departmentId), body.counterId))
  const callToken = validate(v.callTokenSchema, 'body')((r, body) => service.callToken(actor(r), param(r), body.counterId))
  const appointmentStatus = validate(v.appointmentAdminStatusSchema, 'body')((r, body) => service.updateAppointment(actor(r), param(r), body.status, body.note))
  const reschedule = validate(v.appointmentRescheduleSchema, 'body')((r, body) => service.rescheduleAppointment(actor(r), param(r), body.appointmentDate, body.appointmentTime, body.note))
  const queueSettings = validate(v.queueSettingsSchema, 'body')((r, body) => service.updateQueueSettings(actor(r), String(r.params.departmentId), body))
  const settings = validate(v.settingsPatchSchema, 'body')((r, body) => service.updateSettings(actor(r), body))
  const ownProfile = run(r => service.getAdminProfile(actor(r)))
  const patchOwnProfile = validate(v.adminProfilePatchSchema, 'body')((r, body) => service.updateAdminProfile(actor(r), body))
  const ownNotificationPreferences = run(r => service.getAdminNotificationPreferences(actor(r)))
  const patchOwnNotificationPreferences = validate(v.adminNotificationPreferencesSchema, 'body')((r, body) => service.updateAdminNotificationPreferences(actor(r), body))
  return {
    dashboard: run(() => service.dashboard()), metrics: run(() => service.dashboard()),
    tokens: listTokens, token: run(r => service.token(param(r))), tokenStatus, callToken,
    skipToken: run(r => service.updateToken(actor(r), param(r), 'skipped')), completeToken: run(r => service.updateToken(actor(r), param(r), 'completed')), cancelToken: run(r => service.updateToken(actor(r), param(r), 'cancelled')),
    appointments: listAppointments, appointment: run(r => service.appointment(param(r))), appointmentStatus, reschedule,
    approveAppointment: run(r => service.updateAppointment(actor(r), param(r), 'approved')), cancelAppointment: run(r => service.updateAppointment(actor(r), param(r), 'cancelled')), completeAppointment: run(r => service.updateAppointment(actor(r), param(r), 'completed')),
    departments: listDepartments, department: run(r => service.department(param(r))), createDepartment, patchDepartment, deleteDepartment: run(r => service.deleteDepartment(actor(r), param(r))),
    counters: listCounters, counter: run(r => service.counter(param(r))), createCounter, patchCounter, counterStatus, deleteCounter: run(r => service.deleteCounter(actor(r), param(r))),
    queues: run(() => service.queueSummary()), queue: run(r => service.queueDepartment(String(r.params.departmentId))), queueSettings: run(r => service.queueSettings(String(r.params.departmentId))), updateQueueSettings: queueSettings, callNext,
    reports: dateRange, reportQueues: dateRange, reportDepartments: dateRange, reportWaitingTimes: dateRange, reportAppointments: dateRange,
    insights, refreshInsights,
    settings: run(() => service.settings()), updateSettings: settings, activity: activityList,
    profile: ownProfile, updateProfile: patchOwnProfile, notificationPreferences: ownNotificationPreferences, updateNotificationPreferences: patchOwnNotificationPreferences,
  }
}
