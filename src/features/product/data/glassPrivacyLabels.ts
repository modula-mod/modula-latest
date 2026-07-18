import type {ProductPreferences} from '@/features/product/storage/productPreferencesStorage'

export type GlassPrivacyLevel = ProductPreferences['glassPrivacyLevel']

export const GLASS_PRIVACY_LABELS: Record<
  GlassPrivacyLevel,
  {short: string; threadHint: string}
> = {
  'disable-sharing': {
    short: 'Disable Sharing',
    threadHint: 'Forwarding disabled in preview',
  },
  'protected-chat': {
    short: 'Protected Chat',
    threadHint: 'Protected · limited forward (preview)',
  },
  'vault-chat': {
    short: 'Vault Chat',
    threadHint: 'Vault Chat · sandbox required (planned)',
  },
}
