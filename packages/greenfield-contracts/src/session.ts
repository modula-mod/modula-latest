export type GreenfieldSessionStatus = 'active' | 'revoked' | 'expired'

export type GreenfieldSession = {
  sessionId: string
  accountId: string
  status: GreenfieldSessionStatus
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  revokedAt: string | null
  userAgent?: string
  platform?: 'ios' | 'android' | 'web' | 'unknown'
}

export type GreenfieldSessionTokens = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
}
