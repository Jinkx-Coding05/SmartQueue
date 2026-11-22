import { createServer } from 'node:http'
import mongoose from 'mongoose'
import { app } from './app.ts'
import { connectToDatabase } from './config/database.ts'
import { env } from './config/env.ts'

const server = createServer(app)

async function startServer(): Promise<void> {
  await connectToDatabase()
  server.listen(env.port, () => {
    console.log(`[backend] SmartQueue AI API listening on http://localhost:${env.port}`)
    console.log(`[backend] Health check available at http://localhost:${env.port}/api/health`)
  })
}

function shutdown(signal: string): void {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`[backend] ${signal} received; shutting down.`)
  const forceExit = setTimeout(() => {
    console.error('[backend] Graceful shutdown timed out; forcing exit.')
    process.exit(1)
  }, 10_000)
  forceExit.unref()

  server.close((error) => {
    void mongoose.disconnect().then(() => {
      clearTimeout(forceExit)
      if (error) {
        console.error(`[backend] HTTP server shutdown failed: ${error.name}`)
        process.exitCode = 1
        return
      }
      console.log('[backend] HTTP server and MongoDB connection closed.')
    }).catch((disconnectError: unknown) => {
      clearTimeout(forceExit)
      const name = disconnectError instanceof Error ? disconnectError.name : 'UnknownError'
      console.error(`[backend] MongoDB shutdown failed (${name}).`)
      process.exitCode = 1
    })
  })
}

let isShuttingDown = false

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

startServer().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'UnknownError'
  const message = error instanceof Error ? error.message : 'Unknown startup error.'
  console.error(`[backend] Unable to start server (${name}): ${message}`)
  process.exitCode = 1
})
