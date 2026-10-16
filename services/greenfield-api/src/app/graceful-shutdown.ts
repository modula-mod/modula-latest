import type {FastifyInstance} from 'fastify'
import type {ModulaDb} from '../database/client.js'

export function registerGracefulShutdown(app: FastifyInstance, db: ModulaDb, timeoutMs: number): void {
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    app.log.info({signal, timeoutMs}, 'shutting down')
    try {
      await Promise.race([
        app.close(),
        new Promise<never>((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('API graceful shutdown timed out')), timeoutMs)
          timer.unref()
        }),
      ])
      await db.destroy()
      process.exit(0)
    } catch (error) {
      app.log.error({err: error}, 'shutdown failed')
      process.exit(1)
    }
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}
