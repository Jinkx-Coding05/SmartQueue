import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { queueDisplayService, type QueueDisplayService } from '../services/queueDisplayService.ts'

export function createQueueDisplayRouter(service: QueueDisplayService = queueDisplayService) {
  const router = Router()
  const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false })
  router.get('/queue-display', limiter, async (_request, response, next) => {
    try {
      response.setHeader('Cache-Control', 'no-store')
      response.json({ status: 'success', data: await service.getDisplay() })
    } catch (error) { next(error) }
  })
  return router
}

export const queueDisplayRouter = createQueueDisplayRouter()
