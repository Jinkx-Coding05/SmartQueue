import mongoose from 'mongoose'
import { connectToDatabase } from '../config/database.ts'
import { env } from '../config/env.ts'
import { registrationBodySchema } from '../services/authValidation.ts'
import { AuthService } from '../services/authService.ts'

async function provisionCitizen() {
  const missing = [
    ['CITIZEN_FULL_NAME', env.citizenName],
    ['CITIZEN_EMAIL', env.citizenEmail],
    ['CITIZEN_PHONE', env.citizenPhone],
    ['CITIZEN_PASSWORD', env.citizenPassword],
  ].filter(([, value]) => !value).map(([key]) => key)
  if (missing.length) throw new Error(`Set these values in server/.env before provisioning: ${missing.join(', ')}.`)

  const valid = registrationBodySchema.safeParse({
    fullName: env.citizenName,
    email: env.citizenEmail,
    phone: env.citizenPhone,
    password: env.citizenPassword,
    confirmPassword: env.citizenPassword,
  })
  if (!valid.success) throw new Error(`Configured citizen account is invalid: ${valid.error.issues.map((issue) => issue.message).join(' ')}`)

  console.log(`[backend] Provisioning target database: ${targetDatabaseName()}`)
  if (!await connectToDatabase()) throw new Error('MongoDB Atlas connection is required to provision a citizen.')

  const result = await new AuthService().provisionCitizen(valid.data)
  console.log(result.created
    ? '[backend] Citizen account provisioned and verified; role: citizen.'
    : '[backend] An account with the configured citizen email or phone already exists; no changes were made.')
}

function targetDatabaseName() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not configured in server/.env.')
  let pathname: string
  try {
    pathname = new URL(env.mongodbUri).pathname.replace(/^\/+/, '').split('/')[0]
  } catch {
    throw new Error('MONGODB_URI is not a valid Atlas URI.')
  }
  return pathname ? decodeURIComponent(pathname) : 'test'
}

provisionCitizen().catch((error: unknown) => {
  console.error(`[backend] Citizen provisioning failed: ${error instanceof Error ? error.message : 'Unknown error.'}`)
  process.exitCode = 1
}).finally(async () => {
  await mongoose.disconnect()
})
