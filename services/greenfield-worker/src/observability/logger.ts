import pino from 'pino'
import type {WorkerConfig} from '../config.js'

export function createLogger(config: WorkerConfig) {
  return pino({
    level: config.logLevel,
    base: {service: 'modula-worker', workerId: config.workerId},
    redact: {
      paths: [
        'encryptedSession',
        'encrypted_session',
        'session',
        'accessJwt',
        'refreshJwt',
        'password',
        'token',
        'secret',
        'databaseUrl',
        'MODULA_DATABASE_URL',
        'connectionString',
        'encryptionKeys',
      ],
      remove: true,
    },
  })
}

export type WorkerLogger = ReturnType<typeof createLogger>
