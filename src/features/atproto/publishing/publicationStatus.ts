import type {AtprotoConnectionDto, AtprotoPublicationStatus} from '@modula/api-contracts'

import {PUBLICATION_STATUS_LABELS} from '@/features/atproto/copy'

export type UiPublicationStatus =
  | 'publishedOnModula'
  | 'publishingToAtproto'
  | 'publishedToAtproto'
  | 'needsAttention'
  | 'connectionExpired'

export function labelForUiPublicationStatus(status: UiPublicationStatus): string {
  return PUBLICATION_STATUS_LABELS[status]
}

export function mapConnectionToUiPublicationStatus(
  connection: AtprotoConnectionDto | null | undefined,
  publication?: {status?: AtprotoPublicationStatus | null} | null,
): UiPublicationStatus | null {
  if (!connection && !publication) return null
  if (connection?.status === 'revoked' || connection?.status === 'refreshRequired') {
    return 'connectionExpired'
  }
  if (connection?.status === 'error' || connection?.status === 'disconnected') {
    return 'needsAttention'
  }
  if (!publication?.status) {
    return connection ? 'publishedOnModula' : null
  }
  switch (publication.status) {
    case 'pending':
    case 'publishing':
    case 'updating':
    case 'deleting':
      return 'publishingToAtproto'
    case 'published':
      return 'publishedToAtproto'
    case 'failed':
    case 'revoked':
      return 'needsAttention'
    case 'deleted':
      return 'publishedOnModula'
    default:
      return 'publishedOnModula'
  }
}

/** Friendly status copy — never surface raw XRPC errors. */
export function friendlyPublicationMessage(status: UiPublicationStatus): string {
  switch (status) {
    case 'publishedOnModula':
      return 'Your post is saved on Modula.'
    case 'publishingToAtproto':
      return 'Modula is publishing a public copy to your connected AT account.'
    case 'publishedToAtproto':
      return 'A public copy is available on your connected AT account.'
    case 'needsAttention':
      return 'Publishing to AT Protocol needs attention. Your Modula post is still saved.'
    case 'connectionExpired':
      return 'Your AT Protocol connection expired. Reconnect to resume cross-posting.'
  }
}
