import type { Request, Response } from 'express'
import { getMongoConnectionStatus } from '../config/database.ts'
import { env } from '../config/env.ts'

export function getHealth(_request: Request, response: Response): void {
  const mongoStatus = getMongoConnectionStatus()
  response.status(200).json({
    status: 'ok',
    service: 'SmartQueue AI API',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
    mongodb: {
      configured: Boolean(env.mongodbUri),
      status: mongoStatus,
    },
  })
}
