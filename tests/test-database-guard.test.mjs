import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const testUri = 'mongodb+srv://test-user:test-password@cluster.example.net/smartqueue_ai_test?retryWrites=true&w=majority'
const moduleUrl = new URL('../server/src/scripts/testDatabase.ts', import.meta.url).href
const script = `import { configureTestDatabase } from ${JSON.stringify(moduleUrl)}; configureTestDatabase(); console.log('test database configured')`

test('test database setup requires development mode and explicit opt-in', () => {
  assertFailure({ NODE_ENV: 'production', ALLOW_TEST_DATA_SEEDING: 'true', MONGODB_TEST_URI: testUri }, /only run when NODE_ENV=development/)
  assertFailure({ NODE_ENV: 'development', ALLOW_TEST_DATA_SEEDING: 'false', MONGODB_TEST_URI: testUri }, /ALLOW_TEST_DATA_SEEDING=true/)
})

test('test database setup requires a distinct Atlas database with a _test suffix', () => {
  assertFailure({ NODE_ENV: 'development', ALLOW_TEST_DATA_SEEDING: 'true' }, /MONGODB_TEST_URI/)
  assertFailure({ NODE_ENV: 'development', ALLOW_TEST_DATA_SEEDING: 'true', MONGODB_TEST_URI: 'mongodb+srv://u:p@cluster.example.net/smartqueue_ai' }, /ends in _test/)
})

test('test database setup rejects the normal application database without exposing its URI', () => {
  const sameUri = 'mongodb+srv://normal-user:normal-password@cluster.example.net/smartqueue_ai_test'
  const result = run({ NODE_ENV: 'development', ALLOW_TEST_DATA_SEEDING: 'true', MONGODB_TEST_URI: sameUri, MONGODB_URI: sameUri })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /same Atlas database/)
  assert.equal(`${result.stdout}${result.stderr}`.includes('normal-password'), false)
})

test('test database setup accepts the legacy setting only when isolated and explicitly enabled', () => {
  const result = run({ NODE_ENV: 'development', ALLOW_TEST_DATA_SEEDING: 'true', TEST_MONGODB_URI: testUri, MONGODB_URI: 'mongodb+srv://app:secret@cluster.example.net/smartqueue_ai' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /test database configured/)
  assert.equal(`${result.stdout}${result.stderr}`.includes('test-password'), false)
})

function assertFailure(environment, expected) {
  const result = run(environment)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, expected)
}

function run(overrides) {
  return spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, ...overrides },
  })
}
