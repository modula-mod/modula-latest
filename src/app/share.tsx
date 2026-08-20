import {useLocalSearchParams, useRouter} from 'expo-router'
import {View} from 'react-native'

import {ShareToSheet} from '@/features/social/sheets/ShareToSheet'
import {HydratedRouteBoundary} from '@/components/system/HydratedRouteBoundary'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Modal share-to route — Expo BottomSheet via ShareToSheet / ModulaSheet.
 */
export default function ShareRoute() {
  const router = useRouter()
  const {colours} = useThemeTokens()
  const params = useLocalSearchParams<{
    permalink?: string
    message?: string
    title?: string
  }>()

  const permalink = String(params.permalink ?? 'modula://share')
  const shareMessage = String(params.message ?? 'Shared from Modula')
  const title = String(params.title ?? 'Share')

  return (
    <HydratedRouteBoundary>
      <View style={{flex: 1, backgroundColor: colours.canvas}}>
        <ShareToSheet
          isPresented
          onDismiss={() => {
            if (router.canGoBack()) router.back()
            else router.replace('/' as never)
          }}
          title={title}
          permalink={permalink}
          shareMessage={shareMessage}
        />
      </View>
    </HydratedRouteBoundary>
  )
}
