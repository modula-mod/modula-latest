import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import {createRequestId} from '../transport/envelope.js'

export async function registerPlugins(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id']
    const value = Array.isArray(incoming) ? incoming[0] : incoming
    const requestId = createRequestId(value)
    request.id = requestId
    reply.header('x-request-id', requestId)
  })

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  })

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true)
        return
      }
      cb(null, config.allowedOrigins.includes(origin))
    },
    credentials: false,
  })

  if (config.rateLimitEnabled) {
    await app.register(rateLimit, {
      global: false,
      keyGenerator: request => request.ip,
    })
  }
}
