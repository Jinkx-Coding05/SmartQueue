import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), 'server', '.env') })

export function configureTestDatabase() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Test account scripts only run when NODE_ENV=development.')
  if (process.env.ALLOW_TEST_DATA_SEEDING !== 'true') throw new Error('Set ALLOW_TEST_DATA_SEEDING=true in server/.env to enable test account data operations.')
  const uri = (process.env.MONGODB_TEST_URI ?? process.env.TEST_MONGODB_URI)?.trim()
  if (!uri) throw new Error('Set MONGODB_TEST_URI to a dedicated isolated Atlas test database URI.')
  let testTarget: URL
  try { testTarget = new URL(uri) } catch { throw new Error('MONGODB_TEST_URI must be a valid MongoDB Atlas URI.') }
  const databaseName = testTarget.pathname.slice(1).split('/')[0]
  if (!uri.startsWith('mongodb+srv://') || !databaseName.endsWith('_test')) throw new Error('Test scripts only accept an Atlas database whose name ends in _test.')
  const applicationUri = process.env.MONGODB_URI?.trim()
  if (applicationUri) {
    let applicationTarget: URL
    try { applicationTarget = new URL(applicationUri) } catch { throw new Error('MONGODB_URI must be a valid MongoDB Atlas URI.') }
    const applicationDatabase = applicationTarget.pathname.slice(1).split('/')[0]
    if (applicationTarget.host === testTarget.host && applicationDatabase === databaseName) {
      throw new Error('MONGODB_TEST_URI points to the same Atlas database as MONGODB_URI; no test data was changed.')
    }
  }
  process.env.MONGODB_URI = uri
}
