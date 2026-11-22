import cors from 'cors'
import express from 'express'
import { env } from './config/env.ts'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts'
import { authRouter } from './routes/authRoutes.ts'
import { citizenRouter, departmentRouter } from './routes/citizenRoutes.ts'
import { healthRouter } from './routes/healthRoutes.ts'
import { adminRouter } from './routes/adminRoutes.ts'
import { publicStatisticsRouter } from './routes/publicStatisticsRoutes.ts'

export const app = express()

app.disable('x-powered-by')
app.use(cors({
  origin: env.clientUrl,
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
app.use('/api/departments', departmentRouter)
app.use('/api', citizenRouter)
app.use(notFoundHandler)
app.use(errorHandler)
