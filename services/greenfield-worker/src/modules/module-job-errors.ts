import {PermanentJobError, TransientJobError} from '../jobs/errors.js'

export function permanentModuleJob(code: 'VALIDATION_FAILED' | 'UNSUPPORTED_RECORD_TYPE' | 'UNKNOWN_JOB_TYPE', message: string): PermanentJobError {
  return new PermanentJobError(code, message)
}

export function transientModuleJob(code: string, message: string): TransientJobError {
  return new TransientJobError(code, message)
}
