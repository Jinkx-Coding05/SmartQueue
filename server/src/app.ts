import cors from 'cors'
import express from 'express'
import { env } from './config/env.ts'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts'
import { authRouter } from './routes/authRoutes.ts'
import { citizenRouter, departmentRouter } from './routes/citizenRoutes.ts'
import { healthRouter } from './routes/healthRoutes.ts'
import { adminRouter } from './routes/adminRoutes.ts'
import { publicStatisticsRouter } from './routes/publicStatisticsRoutes.ts'
import { queueDisplayRouter } from './routes/queueDisplayRoutes.ts'

export const app = express()

app.disable('x-powered-by')
// Render sends requests through its public proxy before they reach this service.
// Trust the nearest proxy hop so per-IP limits use its forwarded visitor address.
app.set('trust proxy', env.nodeEnv === 'production' ? 1 : false)
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.clientUrls.includes(origin)) { callback(null, true); return }
    callback(null, false)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '1mb' }))

app.get('/', (_request, response) => {
  response.json({ service: 'SmartQueue AI API', message: 'Backend foundation is running.' })
})

app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/public', publicStatisticsRouter)
app.use('/api/public', queueDisplayRouter)
app.use('/api/departments', departmentRouter)
app.use('/api', citizenRouter)
app.use(notFoundHandler)
app.use(errorHandler)
