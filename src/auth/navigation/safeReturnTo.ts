const fallback = '/'

export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return fallback
  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith('/')) return fallback
    if (decoded.startsWith('//')) return fallback
    if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return fallback
    if (decoded.startsWith('/welcome') || decoded.startsWith('/sign-in') || decoded.startsWith('/create-account')) {
      return fallback
    }
    return decoded
  } catch {
    return fallback
  }
}
