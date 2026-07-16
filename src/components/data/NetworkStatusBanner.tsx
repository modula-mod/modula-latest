import {useEffect, useRef, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {useNetworkStatus} from '@/data/network'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function NetworkStatusBanner() {
  const status = useNetworkStatus()
  const {colours, spacing} = useThemeTokens()
  const [showReconnect, setShowReconnect] = useState(false)
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (status.isOffline) {
      wasOfflineRef.current = true
      return
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      const showTimer = setTimeout(() => setShowReconnect(true), 0)
      const hideTimer = setTimeout(() => setShowReconnect(false), 1800)
      return () => {
        clearTimeout(showTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [status.isOffline])

  if (!status.isOffline && !showReconnect) return null

  const message = showReconnect
    ? 'Back online'
    : runtimeEnvironment.dataSource === 'local'
      ? 'Offline — local Modula data is still available.'
      : 'Offline — showing available content.'

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colours.surfaceOverlay,
          borderColor: colours.border,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
        },
      ]}>
      <AppText variant="caption" colour="textSecondary">
        {message}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
    zIndex: 20,
  },
})
