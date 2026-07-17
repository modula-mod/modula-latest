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
        'secret',
        'databaseUrl',
        'MODULA_DATABASE_URL',
        'connectionString',
      ],
      remove: true,
    },
  })
}
