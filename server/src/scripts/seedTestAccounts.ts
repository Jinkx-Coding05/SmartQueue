import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { configureTestDatabase } from './testDatabase.ts'

async function seedTestAccounts() {
  configureTestDatabase()
  const { connectToDatabase } = await import('../config/database.ts')
  const { UserModel } = await import('../models/User.ts')
  const { registrationBodySchema } = await import('../services/authValidation.ts')
  const values = {
    admin: { fullName: process.env.TEST_ADMIN_FULL_NAME ?? '', email: process.env.TEST_ADMIN_EMAIL ?? '', phone: process.env.TEST_ADMIN_PHONE ?? '', password: process.env.TEST_ADMIN_PASSWORD ?? '' },
    citizen: { fullName: process.env.TEST_CITIZEN_FULL_NAME ?? '', email: process.env.TEST_CITIZEN_EMAIL ?? '', phone: process.env.TEST_CITIZEN_PHONE ?? '', password: process.env.TEST_CITIZEN_PASSWORD ?? '' },
  }
  for (const [role, value] of Object.entries(values)) {
    const valid = registrationBodySchema.safeParse({ ...value, confirmPassword: value.password })
    if (!valid.success) throw new Error(`TEST_${role.toUpperCase()}_* credentials are incomplete or invalid: ${valid.error.issues.map((issue) => issue.message).join(' ')}`)
  }
  if (values.admin.email.trim().toLowerCase() === values.citizen.email.trim().toLowerCase() || values.admin.phone.replace(/[\s()-]/g, '') === values.citizen.phone.replace(/[\s()-]/g, '')) {
    throw new Error('TEST_ADMIN and TEST_CITIZEN must use different email addresses and phone numbers; no account was changed.')
  }
  if (!await connectToDatabase()) throw new Error('Could not connect to the isolated Atlas test database.')
  const existingAdmin = await UserModel.findOne({ $or: [{ email: values.admin.email.toLowerCase() }, { phoneNumber: values.admin.phone.replace(/[\s()-]/g, '') }] }).select('+testAccount')
  const citizenEmail = values.citizen.email.trim().toLowerCase()
  const citizenPhone = values.citizen.phone.replace(/[\s()-]/g, '')
  const existingCitizen = await UserModel.findOne({ $or: [{ email: citizenEmail }, { phoneNumber: citizenPhone }] }).select('+testAccount')
  if (existingAdmin && (existingAdmin.testAccount !== true || existingAdmin.role !== 'admin')) throw new Error('Configured test admin email or phone belongs to an account not marked as a test account; no account was changed.')
  if (existingCitizen && (existingCitizen.testAccount !== true || existingCitizen.role !== 'citizen')) throw new Error('Configured test citizen email or phone belongs to an account not marked as a test account; no account was changed.')
  if (!existingAdmin) await UserModel.create({ fullName: values.admin.fullName.trim(), email: values.admin.email.trim().toLowerCase(), phoneNumber: values.admin.phone.replace(/[\s()-]/g, ''), passwordHash: await bcrypt.hash(values.admin.password, 12), passwordChangedAt: new Date(), role: 'admin', emailVerified: true, testAccount: true })
  if (!existingCitizen) await UserModel.create({ fullName: values.citizen.fullName.trim(), email: citizenEmail, phoneNumber: citizenPhone, passwordHash: await bcrypt.hash(values.citizen.password, 12), passwordChangedAt: new Date(), role: 'citizen', emailVerified: true, testAccount: true })
  console.log('[backend] Test admin and citizen accounts are ready in the isolated Atlas test database.')
}

seedTestAccounts().catch((error: unknown) => { console.error(`[backend] Test-account seeding failed: ${error instanceof Error ? error.message : 'Unknown error.'}`); process.exitCode = 1 }).finally(async () => { await mongoose.disconnect() })
