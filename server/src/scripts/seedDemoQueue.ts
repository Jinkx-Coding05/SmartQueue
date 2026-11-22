import { randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import { env } from '../config/env.ts'
import { connectToDatabase } from '../config/database.ts'
import { AdminActivityModel, CounterModel, DepartmentModel, TokenModel, UserModel } from '../models/index.ts'
import { AdminService } from '../services/adminService.ts'
import { AuthService } from '../services/authService.ts'
import { registrationBodySchema } from '../services/authValidation.ts'
import { CitizenService } from '../services/citizenService.ts'

const seedPrefix = 'smartqueue-demo-queue-v1'
const departmentNames = ['General Medicine', 'Orthopedics'] as const
const patientPlans = [
  { name: 'Aarav Kulkarni', department: 'General Medicine', status: 'waiting' },
  { name: 'Meera Desai', department: 'General Medicine', status: 'waiting' },
  { name: 'Rohan Iyer', department: 'General Medicine', status: 'waiting' },
  { name: 'Sana Qureshi', department: 'General Medicine', status: 'serving' },
  { name: 'Kabir Menon', department: 'General Medicine', status: 'completed' },
  { name: 'Anaya Shah', department: 'General Medicine', status: 'completed' },
  { name: 'Vihaan Rao', department: 'General Medicine', status: 'completed' },
  { name: 'Isha Nair', department: 'General Medicine', status: 'completed' },
  { name: 'Arjun Mehta', department: 'Orthopedics', status: 'waiting' },
  { name: 'Diya Patel', department: 'Orthopedics', status: 'waiting' },
  { name: 'Neel Kapoor', department: 'Orthopedics', status: 'waiting' },
  { name: 'Tara Banerjee', department: 'Orthopedics', status: 'serving' },
  { name: 'Devika Rao', department: 'Orthopedics', status: 'completed' },
  { name: 'Ishaan Bose', department: 'Orthopedics', status: 'completed' },
  { name: 'Mira Thomas', department: 'Orthopedics', status: 'completed' },
] as const

type SeedStatus = (typeof patientPlans)[number]['status']
type SeedPatient = { key: string; name: string; email: string; phone: string; department: string; status: SeedStatus; userId: string }

async function seedDemoQueue() {
  if (!env.adminEmail || !env.adminPassword) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env to authenticate the admin queue workflow.')
  }
  console.log(`[backend] Demo queue target database: ${targetDatabaseName()}`)
  if (!await connectToDatabase()) throw new Error('MongoDB Atlas connection failed; no demo queue data was written.')

  const departments = await DepartmentModel.find({ name: { $in: [...departmentNames] }, isActive: true }).select('_id name').lean()
  const departmentsByName = new Map(departments.map((department) => [department.name, String(department._id)]))
  const missingDepartments = departmentNames.filter((name) => !departmentsByName.has(name))
  if (missingDepartments.length) throw new Error(`Required active departments were not found: ${missingDepartments.join(', ')}. No departments are created or changed by this script.`)

  const authService = new AuthService()
  let adminLogin
  try {
    adminLogin = await authService.login({ email: env.adminEmail, password: env.adminPassword })
  } catch {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD did not authenticate an active, verified administrator; no queue seed was written.')
  }
  if (adminLogin.user.role !== 'admin') throw new Error('The configured account is not an administrator; no queue seed was written.')
  const adminContext = await authService.authenticate(adminLogin.accessToken)
  if (adminContext.role !== 'admin') throw new Error('Administrator authorization could not be confirmed; no queue seed was written.')

  const counterPlans = [
    { department: 'General Medicine', key: `${seedPrefix}:counter:general-medicine`, name: 'Demo Queue Counter — General Medicine', counterNumber: 'DEMO-GM-01' },
    { department: 'Orthopedics', key: `${seedPrefix}:counter:orthopedics`, name: 'Demo Queue Counter — Orthopedics', counterNumber: 'DEMO-OR-01' },
  ] as const
  const existingCounters = new Map<string, string>()
  for (const plan of counterPlans) {
    const existing = await CounterModel.findOne({ demoSeedKey: plan.key }).select('+demoSeedKey _id department').lean()
    if (existing) {
      if (String(existing.department) !== departmentsByName.get(plan.department)) throw new Error(`Tagged demo counter for ${plan.department} has a mismatched department; refusing to change it.`)
      existingCounters.set(plan.key, String(existing._id))
      continue
    }
    if (await CounterModel.exists({ counterNumber: plan.counterNumber })) throw new Error(`Counter number ${plan.counterNumber} already exists without this demo seed marker; refusing to modify it.`)
  }

  const patients: SeedPatient[] = patientPlans.map((plan, index) => {
    const number = String(index + 1).padStart(2, '0')
    return {
      key: `${seedPrefix}:patient:${number}`,
      name: plan.name,
      email: `sq-demo-queue-${number}@demo.invalid`,
      phone: `+120255501${number}`,
      department: plan.department,
      status: plan.status,
      userId: '',
    }
  })
  const existingUsers = new Map<string, string>()
  for (const patient of patients) {
    const tagged = await UserModel.findOne({ demoSeedKey: patient.key }).select('+demoSeedKey _id email phoneNumber role').lean()
    if (tagged) {
      if (tagged.role !== 'citizen' || tagged.email !== patient.email || tagged.phoneNumber !== patient.phone) {
        throw new Error(`Tagged demo patient ${patient.key} does not match the seed definition; refusing to change it.`)
      }
      existingUsers.set(patient.key, String(tagged._id))
      continue
    }
    if (await UserModel.exists({ $or: [{ email: patient.email }, { phoneNumber: patient.phone }] })) {
      throw new Error(`A real or untagged account conflicts with synthetic patient ${patient.key}; no account will be overwritten.`)
    }
  }

  const existingTokens = new Map<string, { id: string; citizen: string; department: string }>()
  for (const [index, patient] of patients.entries()) {
    const key = `${seedPrefix}:token:${String(index + 1).padStart(2, '0')}`
    const token = await TokenModel.findOne({ demoSeedKey: key }).select('+demoSeedKey _id citizen department').lean()
    if (!token) continue
    const expectedDepartmentId = departmentsByName.get(patient.department)
    const expectedPatientId = existingUsers.get(patient.key)
    if (!expectedDepartmentId || !expectedPatientId || String(token.department) !== expectedDepartmentId || String(token.citizen) !== expectedPatientId) {
      throw new Error(`Tagged demo token ${key} has mismatched relationships; refusing to change it.`)
    }
    existingTokens.set(key, { id: String(token._id), citizen: String(token.citizen), department: String(token.department) })
  }

  for (const plan of counterPlans) {
    if (existingCounters.has(plan.key)) continue
    const counter = await CounterModel.create({
      name: plan.name,
      counterNumber: plan.counterNumber,
      department: departmentsByName.get(plan.department),
      status: 'available',
      demoSeedKey: plan.key,
    })
    existingCounters.set(plan.key, String(counter._id))
  }

  const citizenService = new CitizenService()
  const authAccounts = new AuthService()
  let createdPatients = 0
  for (const patient of patients) {
    let userId = existingUsers.get(patient.key)
    if (!userId) {
      const generatedPassword = `Demo!${randomBytes(24).toString('base64url')}aA7`
      const input = registrationBodySchema.parse({
        fullName: patient.name,
        email: patient.email,
        phone: patient.phone,
        password: generatedPassword,
        confirmPassword: generatedPassword,
      })
      const result = await authAccounts.provisionCitizen(input, patient.key)
      const inserted = await UserModel.findOne({ demoSeedKey: patient.key }).select('+demoSeedKey _id').lean()
      if (!inserted) throw new Error(result.created ? 'A tagged synthetic citizen could not be read back.' : 'A synthetic citizen account conflict appeared during provisioning; no existing account was modified.')
      userId = String(inserted._id)
      existingUsers.set(patient.key, userId)
      if (result.created) createdPatients += 1
    }
    patient.userId = userId
  }

  let createdTokens = 0
  const patientTokenIds = new Map<string, { id: string; key: string; desired: SeedStatus; department: string }>()
  for (const [index, patient] of patients.entries()) {
    const tokenKey = `${seedPrefix}:token:${String(index + 1).padStart(2, '0')}`
    let tokenId = existingTokens.get(tokenKey)?.id
    if (!tokenId) {
      const created = await citizenService.createToken(patient.userId, { departmentId: departmentsByName.get(patient.department)! }, { demoSeedKey: tokenKey })
      tokenId = created.id
      createdTokens += 1
    }
    patientTokenIds.set(patient.key, { id: tokenId, key: tokenKey, desired: patient.status, department: patient.department })
  }

  const adminService = new AdminService()
  const statusOrder: SeedStatus[] = ['completed', 'serving']
  for (const desired of statusOrder) {
    for (const patient of patients.filter((item) => item.status === desired)) {
      const seededToken = patientTokenIds.get(patient.key)!
      const token = await TokenModel.findById(seededToken.id).select('+demoSeedKey').exec()
      if (!token || token.demoSeedKey !== seededToken.key) throw new Error(`Seed token ${seededToken.key} could not be verified; refusing to advance it.`)
      if (token.status === 'waiting') {
        const counterKey = counterPlans.find((plan) => plan.department === patient.department)!.key
        await adminService.callToken(adminContext.userId, seededToken.id, existingCounters.get(counterKey), `${seededToken.key}:called`)
      } else if (token.status !== 'serving' && token.status !== desired) {
        throw new Error(`Seed token ${seededToken.key} is already ${token.status}; it will not be moved backwards or reset.`)
      }

      if (desired === 'completed') {
        const current = await TokenModel.findById(seededToken.id).select('+demoSeedKey').exec()
        if (current?.status === 'serving') {
          await adminService.updateToken(adminContext.userId, seededToken.id, 'completed', 'Demo queue seed lifecycle', `${seededToken.key}:completed`)
        } else if (current?.status !== 'completed') {
          throw new Error(`Seed token ${seededToken.key} could not reach completed status without a valid queue transition.`)
        }
      }
    }
  }

  const tokenRows = await TokenModel.find({ demoSeedKey: { $in: [...patientTokenIds.values()].map((token) => token.key) } }).select('+demoSeedKey status calledAt department').lean()
  const statuses = { waiting: 0, serving: 0, completed: 0, skipped: 0, cancelled: 0 }
  let calledAtCount = 0
  for (const token of tokenRows) {
    if (token.status in statuses) statuses[token.status as keyof typeof statuses] += 1
    if (token.calledAt) calledAtCount += 1
  }
  const activityCount = await AdminActivityModel.countDocuments({ demoSeedKey: { $regex: `^${seedPrefix}:token:` } })
  console.log(JSON.stringify({
    demoSeed: seedPrefix,
    database: targetDatabaseName(),
    departments: [...departmentNames],
    patients: { created: createdPatients, total: patients.length },
    counters: { created: counterPlans.length - counterPlans.filter((plan) => existingCounters.has(plan.key) && existingCounters.get(plan.key) && false).length, total: counterPlans.length, counterNumbers: counterPlans.map((counter) => counter.counterNumber) },
    tokens: { created: createdTokens, total: tokenRows.length, statuses, calledAtCount, activityRecordsTagged: activityCount },
    note: 'The token schema supports waiting, serving, completed, skipped, and cancelled. Calling through the admin queue service sets calledAt and immediately transitions a token to serving; called is not a separate persisted status.',
  }, null, 2))
}

function targetDatabaseName() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not configured in server/.env.')
  try {
    const name = new URL(env.mongodbUri).pathname.replace(/^\/+/, '').split('/')[0]
    return name ? decodeURIComponent(name) : 'test'
  } catch {
    throw new Error('MONGODB_URI is not a valid Atlas URI.')
  }
}

seedDemoQueue().catch((error: unknown) => {
  console.error(`[backend] Demo queue seeding failed: ${error instanceof Error ? error.message : 'Unknown error.'}`)
  process.exitCode = 1
}).finally(async () => {
  await mongoose.disconnect()
})
