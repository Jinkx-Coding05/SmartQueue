import mongoose from 'mongoose'
import { configureTestDatabase } from './testDatabase.ts'

async function removeTestAccounts() {
  configureTestDatabase()
  const { connectToDatabase } = await import('../config/database.ts')
  const { UserModel } = await import('../models/User.ts')
  const { TokenModel } = await import('../models/Token.ts')
  const { AppointmentModel } = await import('../models/Appointment.ts')
  const { CounterModel } = await import('../models/Counter.ts')
  const { DocumentModel } = await import('../models/Document.ts')
  const { NotificationModel } = await import('../models/Notification.ts')
  const { AdminActivityModel } = await import('../models/AdminActivity.ts')
  if (!await connectToDatabase()) throw new Error('Could not connect to the isolated Atlas test database.')
  const users = await UserModel.find({ testAccount: true }).select('_id')
  const userIds = users.map((user) => user._id)
  const tokens = await TokenModel.find({ citizen: { $in: userIds } }).select('_id')
  const tokenIds = tokens.map((token) => token._id)
  if (tokenIds.length) await CounterModel.updateMany({ currentServingTokenId: { $in: tokenIds } }, { $set: { status: 'available', currentServingToken: null, currentServingTokenId: null } })
  await Promise.all([
    TokenModel.deleteMany({ citizen: { $in: userIds } }), AppointmentModel.deleteMany({ citizen: { $in: userIds } }),
    DocumentModel.deleteMany({ citizen: { $in: userIds } }), NotificationModel.deleteMany({ user: { $in: userIds } }),
    AdminActivityModel.deleteMany({ actor: { $in: userIds } }),
  ])
  const result = await UserModel.deleteMany({ _id: { $in: userIds }, testAccount: true })
  console.log(`[backend] Removed ${result.deletedCount} marked test account(s) and their test-owned records from the isolated database.`)
}

removeTestAccounts().catch((error: unknown) => { console.error(`[backend] Test-account cleanup failed: ${error instanceof Error ? error.message : 'Unknown error.'}`); process.exitCode = 1 }).finally(async () => { await mongoose.disconnect() })
