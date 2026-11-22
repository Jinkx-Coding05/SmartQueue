import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, test } from 'node:test'

const frontendOrigin = 'https://smart-queue-94ceuh7kx-invicta-stack.vercel.app'
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'cors-test-secret-that-is-long-enough'
process.env.MONGODB_URI = ''
process.env.CLIENT_URL = frontendOrigin
process.env.CLIENT_URLS = 'http://localhost:5173'

const { app } = await import('../server/src/app.ts')
const server = createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('CORS allows the configured Vercel origin and the localhost development origin', async () => {
  for (const origin of [frontendOrigin, 'http://localhost:5173']) {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), origin)
  }
})

test('CORS does not grant an unconfigured origin access', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://untrusted.example' } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('API OPTIONS preflight allows POST, Authorization and Content-Type without cookie credentials', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: frontendOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), frontendOrigin)
  assert.match(response.headers.get('access-control-allow-methods') ?? '', /POST/)
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /Authorization/i)
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /Content-Type/i)
  assert.equal(response.headers.get('access-control-allow-credentials'), null)
})
