/**
 * Private/internal Modula field names that must never appear in an AT Protocol
 * record body. These lexicons are public-by-definition (published to a PDS),
 * so any of these keys showing up anywhere in a record is treated as a bug,
 * not a policy choice.
 */
export const FORBIDDEN_PRIVATE_FIELDS = [
  'email',
  'emailAddress',
  'password',
  'passwordHash',
  'sessionToken',
  'accessToken',
  'refreshToken',
  'authToken',
  'oauthToken',
  'dpopKey',
  'dpopNonce',
  'privateKey',
  'secret',
  'apiKey',
  'ipAddress',
  'deviceId',
  'phoneNumber',
  'ssn',
  'actorId',
  'internalId',
  'moderationNotes',
] as const

export function findForbiddenFields(value: unknown, path = ''): string[] {
  const hits: string[] = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...findForbiddenFields(item, `${path}[${index}]`)))
    return hits
  }
  if (typeof value !== 'object' || value === null) return hits
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key
    if ((FORBIDDEN_PRIVATE_FIELDS as readonly string[]).includes(key)) {
      hits.push(nextPath)
    }
    hits.push(...findForbiddenFields(nested, nextPath))
  }
  return hits
}
