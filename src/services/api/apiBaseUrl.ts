export function normalizeApiBaseUrl(value: string) {
  const baseUrl = value.trim().replace(/\/+$/, '')
  if (!baseUrl) return '/api'
  return /\/api$/i.test(baseUrl) ? baseUrl : `${baseUrl}/api`
}
