import {ModulaApiError} from '@/api/contracts/ApiError'

declare const accountIdBrand: unique symbol
declare const profileIdBrand: unique symbol
declare const postIdBrand: unique symbol
declare const sessionIdBrand: unique symbol

export type AccountId = string & {readonly [accountIdBrand]: true}
export type ProfileId = string & {readonly [profileIdBrand]: true}
export type PostId = string & {readonly [postIdBrand]: true}
export type SessionId = string & {readonly [sessionIdBrand]: true}

// Accept local prefixed ids (`session-…`) and Greenfield UUIDv7 ids (`019f…`).
const idPattern = /^[a-z0-9][a-z0-9-]{2,80}$/i

function parseIdentifier<T extends string>(value: unknown, label: string): T {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    throw new ModulaApiError({
      message: `Invalid ${label}.`,
      code: 'INVALID_RESPONSE',
      status: 0,
      retryable: false,
    })
  }
  return value as T
}

export function parseAccountId(value: unknown): AccountId {
  return parseIdentifier<AccountId>(value, 'account id')
}

export function parseProfileId(value: unknown): ProfileId {
  return parseIdentifier<ProfileId>(value, 'profile id')
}

export function parsePostId(value: unknown): PostId {
  return parseIdentifier<PostId>(value, 'post id')
}

export function parseSessionId(value: unknown): SessionId {
  return parseIdentifier<SessionId>(value, 'session id')
}
