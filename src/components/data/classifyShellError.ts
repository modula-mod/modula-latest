import {isModulaApiError} from '@/api/contracts'

export type ShellErrorKind =
  | 'offline'
  | 'timeout'
  | 'unauthenticated'
  | 'permission'
  | 'not-found'
  | 'unavailable'
  | 'unexpected'

export function classifyShellError(error: unknown): ShellErrorKind {
  if (!isModulaApiError(error)) return 'unexpected'
  if (error.code === 'OFFLINE') return 'offline'
  if (error.code === 'TIMEOUT') return 'timeout'
  if (error.code === 'UNAUTHENTICATED' || error.code === 'SESSION_EXPIRED') {
    return 'unauthenticated'
  }
  if (error.code === 'FORBIDDEN' || error.code === 'CAPABILITY_DISABLED') {
    return 'permission'
  }
  if (error.code === 'NOT_FOUND') return 'not-found'
  if (
    error.code === 'SERVER_ERROR' ||
    error.code === 'RATE_LIMITED' ||
    error.code === 'AUTHENTICATION_NOT_AVAILABLE'
  ) {
    return 'unavailable'
  }
  return 'unexpected'
}

export function shellErrorTitle(kind: ShellErrorKind): string {
  switch (kind) {
    case 'offline':
      return 'You’re offline'
    case 'timeout':
      return 'This is taking too long'
    case 'unauthenticated':
      return 'Sign in to continue'
    case 'permission':
      return 'This isn’t available'
    case 'not-found':
      return 'Nothing here'
    case 'unavailable':
      return 'Modula is unavailable'
    default:
      return 'Couldn’t load this'
  }
}
