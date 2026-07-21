import type {GreenfieldAccount, GreenfieldAccountStatus} from '@modula/greenfield-contracts'

import {parseAccountId} from '@/api/contracts/identifiers'
import {asIsoDate, asRecord, asString} from '@/api/decoding/validation'
import type {ModulaAccount} from '@/domain/account'

const ACCOUNT_STATUSES = new Set<GreenfieldAccountStatus>([
  'pendingVerification',
  'active',
  'suspended',
  'deactivated',
  'deleted',
])

function asAccountStatus(value: unknown, label: string): GreenfieldAccountStatus {
  const status = asString(value, label)
  if (!ACCOUNT_STATUSES.has(status as GreenfieldAccountStatus)) {
    throw new Error(`Invalid ${label}: ${status}`)
  }
  return status as GreenfieldAccountStatus
}

export function decodeGreenfieldAccount(value: unknown): GreenfieldAccount & {email?: string} {
  const account = asRecord(value, 'greenfield account')
  const accountId = asString(account.accountId ?? account.account_id, 'accountId')
  return {
    accountId,
    primaryHandle: asString(account.primaryHandle ?? account.primary_handle, 'primaryHandle'),
    status: asAccountStatus(account.status, 'account status'),
    createdAt: asIsoDate(account.createdAt ?? account.created_at, 'createdAt'),
    updatedAt: asIsoDate(account.updatedAt ?? account.updated_at, 'updatedAt'),
    email: typeof account.email === 'string' ? account.email : undefined,
  }
}

export function toModulaAccount(
  account: GreenfieldAccount & {email?: string},
  displayName?: string,
): ModulaAccount {
  return {
    id: parseAccountId(account.accountId),
    accountId: account.accountId,
    email: account.email ?? '',
    displayName: displayName ?? account.primaryHandle,
    primaryHandle: account.primaryHandle,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}
