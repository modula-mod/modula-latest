import {useEffect} from 'react'
import {View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {useAppLock} from '@/features/security/app-lock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Dedicated unlock route — triggers the root AppLockGate when lock is enabled.
 * Live cold-start / auto-lock is handled by AppLockGate in `_layout.tsx`.
 */
export default function AppLockUnlockRoute() {
  const {colours, spacing} = useThemeTokens()
  const {enabled, lock, locked} = useAppLock()
  const router = useRouter()

  useEffect(() => {
    if (enabled) {
      lock()
      return
    }
    router.replace('/settings/app-lock' as Href)
  }, [enabled, lock, router])

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colours.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[5],
      }}>
      <AppText variant="caption" colour="textSecondary" style={{textAlign: 'center'}}>
        {locked
          ? 'Waiting for unlock…'
          : enabled
            ? 'Locking…'
            : 'App Lock is not enabled on this device.'}
      </AppText>
    </View>
  )
}
