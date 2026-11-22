import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeApiBaseUrl } from '../src/services/api/apiBaseUrl.ts'

test('API base URL adds the backend /api prefix when configured with only an origin', () => {
  assert.equal(normalizeApiBaseUrl('https://smartqueue-0nka.onrender.com'), 'https://smartqueue-0nka.onrender.com/api')
})

test('API base URL preserves an existing /api prefix and removes trailing slashes', () => {
  assert.equal(normalizeApiBaseUrl('https://smartqueue-0nka.onrender.com/api/'), 'https://smartqueue-0nka.onrender.com/api')
})
