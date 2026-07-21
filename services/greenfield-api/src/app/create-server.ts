import Fastify, {type FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import {createDb, type ModulaDb} from '../database/client.js'
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
          'secret',
          'databaseUrl',
          'MODULA_DATABASE_URL',
          'connectionString',
        ],
        remove: true,
      },
    },
    trustProxy: config.trustProxy,
    bodyLimit: 1_048_576,
    genReqId: () => '',
  })
  const db = createDb(config.databaseUrl)
  await registerPlugins(app, config)
  await registerRoutes(app, db, config)
  registerGracefulShutdown(app, db)
  return {app, db, config}
}
