import {PermanentJobError, TransientJobError} from '../jobs/errors.js'

export function permanentModuleJob(code: 'VALIDATION_FAILED' | 'PERMISSION_REVIEW_REQUIRED' | 'UNTRUSTED_RELEASE' | 'UNSUPPORTED_RECORD_TYPE' | 'UNKNOWN_JOB_TYPE', message: string): PermanentJobError {
  return new PermanentJobError(code, message)
}

export function transientModuleJob(code: string, message: string): TransientJobError {
  return new TransientJobError(code, message)
}
