const idPattern = /^[a-z][a-z0-9-]{2,80}$/i
const handlePattern = /^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$/i

export function isModulaId(value: string): boolean {
  return idPattern.test(value)
}

export function isModulaHandle(value: string): boolean {
  return handlePattern.test(value)
}

export function assertModulaId(value: string, label = 'id'): string {
  if (!isModulaId(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}
