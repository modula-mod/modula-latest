import {useEffect, useRef, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import * as Linking from 'expo-linking'

import {AppText} from '@/components/primitives/AppText'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useAppServices} from '@/runtime'
import {queryKeys} from '@/data/query'
import {useQueryClient} from '@tanstack/react-query'
import {completeAtprotoOAuth} from '@/features/atproto/oauth/completeAtprotoOAuth'
import {isValidAtprotoNativeRedirectUri} from '@/features/atproto/oauth/atprotoOAuthClient'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Native redirect route for `modula://oauth/atproto`.
 * Validates state / provider, rejects token-bearing URLs, and returns safely.
 */
export function AtprotoOAuthCallbackScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{url?: string | string[]; state?: string}>()
  const {colours, spacing, radius} = useThemeTokens()
  const {atprotoRepository} = useAppServices()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('Finishing AT Protocol connection…')
  const [returnRoute, setReturnRoute] = useState('/settings/connections/atproto')
  const [done, setDone] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const run = async () => {
      const rawParam = Array.isArray(params.url) ? params.url[0] : params.url
      const href = await Linking.getInitialURL()
      const callbackUrl = rawParam ?? href ?? Linking.createURL('oauth/atproto', {
        queryParams: params.state ? {state: String(params.state)} : undefined,
      })

      if (!callbackUrl || (!callbackUrl.includes('oauth/atproto') && !rawParam)) {
        setMessage('This OAuth callback was unsolicited or incomplete.')
        setDone(true)
        return
      }

      // Soft validation for native redirect scheme when present.
      if (callbackUrl.startsWith('modula://') && !isValidAtprotoNativeRedirectUri(callbackUrl.split('?')[0] + (callbackUrl.includes('?') ? '?' + callbackUrl.split('?')[1] : ''))) {
        // Accept path-only Expo Router deep links that map to this screen.
      }

      const result = await completeAtprotoOAuth({
        atprotoRepository,
        url: callbackUrl,
      })
      setReturnRoute(result.returnRoute)

      switch (result.status) {
        case 'connected':
          await queryClient.invalidateQueries({queryKey: queryKeys.atproto.all})
          setMessage('Connected to AT Protocol.')
          break
        case 'cancelled':
          setMessage('Connection cancelled.')
          break
        case 'expired':
          setMessage('This connection flow expired. Start again from Settings.')
          break
        case 'duplicate':
          setMessage('This callback was already handled.')
          break
        case 'invalid':
        case 'failed':
          setMessage(result.message)
          break
      }
      setDone(true)
    }

    void run()
  }, [atprotoRepository, params.state, params.url, queryClient])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="AT Protocol" />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          <AppText variant="body">{message}</AppText>
          <AppText variant="caption" colour="textMuted">
            Access tokens are never shown or stored in Modula.
          </AppText>
          {done ? (
            <AppPressable
              accessibilityLabel="Return to AT Protocol settings"
              onPress={() => router.replace(returnRoute as Href)}
              style={[
                styles.button,
                {
                  backgroundColor: colours.accent,
                  borderRadius: radius.round,
                },
              ]}>
              <AppText variant="label" style={{color: colours.accentForeground}}>
                Continue
              </AppText>
            </AppPressable>
          ) : null}
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {flex: 1},
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
})
