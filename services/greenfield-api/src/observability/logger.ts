import pino from 'pino'
import type {AppConfig} from '../config/index.js'

export function createLogger(config: AppConfig) {
  return pino({
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
        'pkceVerifier',
        'secret',
        'clientSecret',
        'databaseUrl',
        'MODULA_DATABASE_URL',
        'connectionString',
      ],
      remove: true,
    },
  })
}
