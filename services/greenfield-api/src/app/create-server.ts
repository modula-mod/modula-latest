import type {IncomingHttpHeaders} from 'node:http'
import Fastify, {type FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import {createDb, type ModulaDb} from '../database/client.js'
import {createRequestId} from '../transport/envelope.js'
import {registerGracefulShutdown} from './graceful-shutdown.js'
import {registerPlugins} from './register-plugins.js'
import {registerRoutes} from './register-routes.js'
import type {PublisherConsoleTestOptions} from '../publisher/routes.js'
import type {PublisherReleaseJobRunner} from '../publisher/release-job-runner.js'
import type {PremiumAppleVerifier} from '../premium/apple-verifier.js'

/** Programmatic test hooks only; never read from environment or production config. */
export type CreateServerTestOptions = {
  publisherConsole?: PublisherConsoleTestOptions
  premiumAppleVerifier?: PremiumAppleVerifier | null
}

export type CreatedServer = {
  app: FastifyInstance
  db: ModulaDb
  config: AppConfig
  /** Present only with publisherConsole test options. Tick explicitly, off the HTTP path. */
  publisherReleaseJobRunner?: PublisherReleaseJobRunner
}

export async function createServer(config: AppConfig, testOptions: CreateServerTestOptions = {}): Promise<CreatedServer> {
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
          'req.body.signedTransaction',
          'req.body.signedPayload',
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
  const {publisherReleaseJobRunner} = await registerRoutes(app, db, config, testOptions)
  registerGracefulShutdown(app, db, config.shutdownTimeoutMs)
  return {app, db, config, publisherReleaseJobRunner}
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
