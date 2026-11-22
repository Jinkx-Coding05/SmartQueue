import mongoose from 'mongoose'
import { env } from './env.ts'

export type MongoConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

let connectionFailed = false

export async function connectToDatabase(): Promise<boolean> {
  if (!env.mongodbUri) {
    console.warn('[backend] MONGODB_URI is not configured. Add the Atlas URI to the local .env file; starting API without a database connection.')
    return false
  }

  try {
    await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 })
    connectionFailed = false
    console.log('[backend] MongoDB connected.')
    return true
  } catch (error) {
    connectionFailed = true
    const name = error instanceof Error ? error.name : 'UnknownError'
    const details = error instanceof Error ? sanitizeMongoError(error.message) : 'Unknown connection error.'
    console.error(`[backend] MongoDB Atlas connection failed (${name}): ${details}`)
    console.warn('[backend] API will remain available with MongoDB health status set to error.')
    return false
  }
}

export function getMongoConnectionStatus(): MongoConnectionStatus {
  if (connectionFailed && mongoose.connection.readyState !== 1) return 'error'
  switch (mongoose.connection.readyState) {
    case 0:
      return 'disconnected'
    case 1:
      return 'connected'
    case 2:
      return 'connecting'
    default:
      return 'error'
  }
}

function sanitizeMongoError(message: string) {
  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, 'mongodb+srv://[REDACTED]')
    .replace(/(password\s*[=:]\s*)[^\s&;,]+/gi, '$1[REDACTED]')
}
