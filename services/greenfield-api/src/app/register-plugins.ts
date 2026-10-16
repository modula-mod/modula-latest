import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import {failureEnvelope} from '../transport/envelope.js'

export async function registerPlugins(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id)
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
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-Request-Id', 'X-Modula-Request-Id', 'X-Attachment-Checksum'],
    credentials: false,
  })

  if (config.rateLimitEnabled) {
    await app.register(rateLimit, {
      global: false,
      keyGenerator: request => request.ip,
      errorResponseBuilder: (request, context) => {
        const envelope = failureEnvelope(
          'RATE_LIMITED',
          `Rate limit exceeded; retry after ${context.after}`,
          request.id,
          {retryable: true, details: {retryAfter: context.after, limit: context.max}},
        )
        // @fastify/rate-limit throws the builder result and Fastify derives the HTTP
        // response code from error.statusCode. Keep that transport hint available to
        // Fastify without leaking it as an undocumented public envelope field.
        Object.defineProperty(envelope, 'statusCode', {value: context.statusCode, enumerable: false})
        return envelope
      },
    })
  }
}
