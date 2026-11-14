import type {Transaction} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {Database} from '../database/types.js'
import {ChallengeService} from '../auth/challenges/service.js'
import {displayNameFromIdentityMetadata, MailService} from '../mail/service.js'

export type EmailVerificationChallengeIssue = {
  challengeId: string
  expiresAt: string
  delivery: {channel: 'email'; recipient: string}
}

export function emailVerificationTtlSeconds(config: Pick<AppConfig, 'emailVerificationTtlHours'>): number {
  return Math.max(10 * 60, config.emailVerificationTtlHours * 3_600)
}

/**
 * Issue a fresh email-verification challenge for a pending account and queue the
 * code. Uses the same purpose, rate-limit keys (account, email, IP) and supersede
 * behaviour as registration, so every send path shares one verification budget.
 */
export async function issuePendingEmailVerification(
  trx: Transaction<Database>,
  deps: {challenges: ChallengeService; mail?: MailService; config: Pick<AppConfig, 'emailVerificationTtlHours'>},
  input: {
    accountId: string
    email: string
    handle: string
    identityMetadata: unknown
    ipHash?: string | null
    correlationId?: string
    issuedFor: string
  },
): Promise<EmailVerificationChallengeIssue> {
  const email = input.email.trim().toLowerCase()
  const challenge = await deps.challenges.forDb(trx).create({
    purpose: 'email_verification',
    accountId: input.accountId,
    methodId: `email-otp-${input.accountId}`,
    subjectIdentifier: email,
    deliveryChannel: 'email',
    ttlSeconds: emailVerificationTtlSeconds(deps.config),
    attemptLimit: 5,
    rateLimitKeys: [
      `account:${input.accountId}`,
      `email:${email}`,
      ...(input.ipHash ? [`ip:${input.ipHash}`] : []),
    ],
    supersedeExisting: true,
    metadata: {
      issuedFor: input.issuedFor,
      recipient: maskVerificationEmail(email),
    },
  })
  await deps.mail?.queueVerification(trx, {
    accountId: input.accountId,
    email,
    displayName: displayNameFromIdentityMetadata(input.identityMetadata, input.handle),
    handle: input.handle,
    code: challenge.code,
    expiresAt: challenge.expiresAt,
    correlationId: input.correlationId,
  })
  return {
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt.toISOString(),
    delivery: {channel: 'email', recipient: maskVerificationEmail(email)},
  }
}

/**
 * Decoy for an unknown or non-pending email: same challenge shape, TTL and
 * email/IP rate-limit keys, but bound to no account, no method and no mail. The
 * code is never delivered and `verifyEmailCode` rejects account-less challenges.
 */
export async function issueDecoyEmailVerification(
  trx: Transaction<Database>,
  deps: {challenges: ChallengeService; config: Pick<AppConfig, 'emailVerificationTtlHours'>},
  input: {email: string; ipHash?: string | null; issuedFor: string},
): Promise<EmailVerificationChallengeIssue> {
  const email = input.email.trim().toLowerCase()
  const challenge = await deps.challenges.forDb(trx).create({
    purpose: 'email_verification',
    accountId: null,
    methodId: null,
    subjectIdentifier: email,
    deliveryChannel: 'email',
    ttlSeconds: emailVerificationTtlSeconds(deps.config),
    attemptLimit: 5,
    rateLimitKeys: [`email:${email}`, ...(input.ipHash ? [`ip:${input.ipHash}`] : [])],
    supersedeExisting: true,
    metadata: {
      issuedFor: input.issuedFor,
      recipient: maskVerificationEmail(email),
      deliverable: false,
    },
  })
  return {
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt.toISOString(),
    delivery: {channel: 'email', recipient: maskVerificationEmail(email)},
  }
}

export function maskVerificationEmail(email: string): string {
  const [local = '', domain = 'unknown'] = email.split('@')
  if (local.length <= 1) return `*@${domain}`
  return `${local[0]}${'•'.repeat(Math.min(5, Math.max(1, local.length - 1)))}@${domain}`
}
