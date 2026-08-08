export function mailValidationError(message: string): Error {
  return Object.assign(new Error(message), {code: 'VALIDATION_FAILED'})
}
