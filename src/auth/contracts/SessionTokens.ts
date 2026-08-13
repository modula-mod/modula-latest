export type AccessToken = string & {
  readonly __accessToken: unique symbol
}

export type RefreshToken = string & {
  readonly __refreshToken: unique symbol
}

export type SessionTokenPair = {
  accessToken: AccessToken
  refreshToken: RefreshToken
  accessTokenExpiresAt: string
  refreshTokenExpiresAt?: string
}

export function parseAccessToken(value: string): AccessToken {
  return value as AccessToken
}

export function parseRefreshToken(value: string): RefreshToken {
  return value as RefreshToken
}
