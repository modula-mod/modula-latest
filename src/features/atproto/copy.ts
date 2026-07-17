/** Product copy for optional AT Protocol bridge under External Networks. */

export const ATPROTO_SETTINGS_TITLE = 'AT Protocol'
export const ATPROTO_SETTINGS_DESCRIPTION =
  'Optional External Network bridge. Not required for a Modula Account.'

export const ATPROTO_PUBLIC_DATA_WARNING = [
  'AT Protocol repositories contain public records.',
  '',
  'Only content you explicitly publish publicly will be written to your connected AT account.',
  '',
  'Private Modula data, modules, settings and messages remain on Greenfield.',
].join('\n')

export const ATPROTO_PUBLIC_DATA_ACK_LABEL =
  'I understand that AT Protocol publishing is public and opt-in.'

/** Demoted from primary Discover IA; optional bridge preview label only. */
export const ATMOSPHERE_PREVIEW_LABEL = 'External network preview'

export const ORIGIN_LABELS = {
  modula: 'Modula',
  atproto: 'AT Protocol',
  'modula+atproto': 'Modula + AT Protocol',
} as const

export const PUBLICATION_STATUS_LABELS = {
  publishedOnModula: 'Published on Modula',
  publishingToAtproto: 'Publishing to AT Protocol',
  publishedToAtproto: 'Published to AT Protocol',
  needsAttention: 'AT publishing needs attention',
  connectionExpired: 'AT connection expired',
} as const

export const DEFAULT_PUBLISHING_DESTINATION = 'modula' as const
