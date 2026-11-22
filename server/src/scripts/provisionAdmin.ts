import mongoose from 'mongoose'
import { connectToDatabase } from '../config/database.ts'
import { env } from '../config/env.ts'
import { UserModel } from '../models/User.ts'
import { AuthService } from '../services/authService.ts'
import { registrationBodySchema } from '../services/authValidation.ts'

async function provisionAdmin() {
  const missing = [
    ['ADMIN_FULL_NAME', env.adminName],
    ['ADMIN_EMAIL', env.adminEmail],
    ['ADMIN_PHONE', env.adminPhone],
    ['ADMIN_PASSWORD', env.adminPassword],
  ].filter(([, value]) => !value).map(([key]) => key)
  if (missing.length) throw new Error(`Set these values in server/.env before provisioning: ${missing.join(', ')}.`)

  const valid = registrationBodySchema.safeParse({
    fullName: env.adminName,
    email: env.adminEmail,
    phone: env.adminPhone,
    password: env.adminPassword,
    confirmPassword: env.adminPassword,
  })
  if (!valid.success) throw new Error(`Configured admin account is invalid: ${valid.error.issues.map((issue) => issue.message).join(' ')}`)
  console.log(`[backend] Provisioning target database: ${targetDatabaseName()}`)
  if (!await connectToDatabase()) throw new Error('MongoDB Atlas connection is required to provision an administrator.')

  const existing = await UserModel.exists({ email: valid.data.email.trim().toLowerCase(), role: 'admin' })
  if (existing) {
    console.log('[backend] Admin account already exists; no changes were made.')
    return
  }

  const user = await new AuthService().provisionAdmin(valid.data)
  console.log(`[backend] Admin account provisioned with role ${user.role}.`)
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

provisionAdmin().catch((error: unknown) => {
  console.error(`[backend] Admin provisioning failed: ${error instanceof Error ? error.message : 'Unknown error.'}`)
  process.exitCode = 1
}).finally(async () => {
  await mongoose.disconnect()
})
