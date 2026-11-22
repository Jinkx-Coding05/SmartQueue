import { Router } from 'express'
import { z } from 'zod'
import { publicStatisticsService, type PublicStatisticsService } from '../services/publicStatisticsService.ts'

export function createPublicStatisticsRouter(service: PublicStatisticsService = publicStatisticsService) {
  const router = Router()
  router.get('/statistics', async (request, response, next) => {
    const parsed = z.object({ period: z.enum(['today', '7d', '30d']).default('7d') }).strict().safeParse(request.query)
    if (!parsed.success) { response.status(400).json({ status: 'error', message: 'Statistics period is invalid.' }); return }
    try {
      response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
      response.json({ status: 'success', data: await service.get(parsed.data.period) })
    } catch (error) { next(error) }
  })
  return router
}

export const publicStatisticsRouter = createPublicStatisticsRouter()
