import type { ErrorRequestHandler, RequestHandler } from 'express'

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ status: 'error', message: 'Route not found.' })
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const statusCode = getErrorStatus(error)
  const safeMessage = statusCode < 500 && error instanceof Error ? error.message : 'An unexpected server error occurred.'
  if (statusCode >= 500) {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    console.error(`[backend] Request failed (${errorName}, ${statusCode}): ${sanitizeLogValue(error instanceof Error ? error.message : 'Unknown request error.')}`)
  }
  response.status(statusCode).json({ status: 'error', message: safeMessage })
}

function getErrorStatus(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    if ('status' in error) {
      const status = error.status
      if (typeof status === 'number' && status >= 400 && status <= 599) return status
    }
    if ('statusCode' in error) {
      const statusCode = error.statusCode
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode <= 599) return statusCode
    }
  }
  return 500
}

function sanitizeLogValue(value: string) {
  return value
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, 'mongodb+srv://[REDACTED]')
    .replace(/(password\s*[=:]\s*)[^\s&;,]+/gi, '$1[REDACTED]')
    .replace(/bearer\s+[a-z0-9._~-]+/gi, 'Bearer [REDACTED]')
}
