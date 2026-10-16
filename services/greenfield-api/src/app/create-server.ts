import type {IncomingHttpHeaders} from 'node:http'
import Fastify, {type FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import {createDb, type ModulaDb} from '../database/client.js'
import {createRequestId} from '../transport/envelope.js'
import {registerGracefulShutdown} from './graceful-shutdown.js'
import {registerPlugins} from './register-plugins.js'
import {registerRoutes} from './register-routes.js'

export type CreatedServer = {
  app: FastifyInstance
  db: ModulaDb
  config: AppConfig
}

export async function createServer(config: AppConfig): Promise<CreatedServer> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'password',
          'token',
          'accessToken',
          'refreshToken',
          'credentials',
          'providerCredential',
          'apiKey',
          'pkceVerifier',
          'secret',
          'clientSecret',
          'databaseUrl',
          'MODULA_DATABASE_URL',
          'connectionString',
        ],
        remove: true,
      },
    },
    trustProxy: config.trustProxy,
    bodyLimit: config.requestBodyLimitBytes,
    genReqId: request => requestIdFromHeaders(request.headers),
  })
  const db = createDb(config.databaseUrl, error => app.log.error({error: safeDatabaseError(error)}, 'database pool idle client error'))
  await registerPlugins(app, config)
  await registerRoutes(app, db, config)
  registerGracefulShutdown(app, db, config.shutdownTimeoutMs)
  return {app, db, config}
}

export function requestIdFromHeaders(headers: IncomingHttpHeaders): string {
  const standard = firstHeader(headers['x-request-id'])
  const modula = firstHeader(headers['x-modula-request-id'])
  return createRequestId(standard ?? modula)
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function safeDatabaseError(error: Error) {
  const code = (error as Error & {code?: unknown}).code
  return {name: error.name, message: error.message, code: typeof code === 'string' ? code : null}
}
