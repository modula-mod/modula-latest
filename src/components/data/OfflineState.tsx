import {AppText} from '@/components/primitives/AppText'

export function OfflineState({local}: {local: boolean}) {
  return (
    <AppText variant="caption" colour="textSecondary">
      {local
        ? 'You’re offline. Local Modula data remains available.'
        : 'You’re offline. Some content may be unavailable.'}
    </AppText>
  )
}
