import {useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useSession, useSessionActions} from '@/auth/runtime'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function SessionRuntimeScreen() {
  const session = useSession()
  const actions = useSessionActions()
  const services = useAppServices()
  const {spacing} = useThemeTokens()
  const controller = services.localApiController
  const [actionError, setActionError] = useState<string | null>(null)

  const runDemo = (email: 'andrei@modula.local' | 'gaia@modula.local') => {
    setActionError(null)
    void actions.continueAsDemo(email).catch(error => {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Demo sign-in failed. Local demo passwords are rejected by remote Greenfield.',
      )
    })
  }

  return (
    <AppScreen scroll>
      <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
        <AppText variant="display">Session Lab</AppText>
        <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
          <Info label="State" value={session.status} />
          <Info label="SecureStore failure" value={controller?.isSecureStoreFailureSimulated() ? 'enabled' : 'disabled'} />
          {actionError ? (
            <AppText variant="caption" colour="destructive">
              {actionError}
            </AppText>
          ) : null}
          <AppButton onPress={() => runDemo('andrei@modula.local')}>
            Continue as Andrei
          </AppButton>
          <AppButton variant="secondary" onPress={() => runDemo('gaia@modula.local')}>
            Continue as Gaia
          </AppButton>
          <AppButton variant="secondary" onPress={actions.continueAsGuest}>
            Continue as Guest
          </AppButton>
          <AppButton variant="secondary" onPress={() => void actions.signOut()}>
            Sign out
          </AppButton>
          {controller ? (
            <>
              <AppButton variant="secondary" onPress={controller.expireAccessToken}>
                Expire access token
              </AppButton>
              <AppButton variant="secondary" onPress={controller.invalidateRefreshToken}>
                Invalidate refresh token
              </AppButton>
              <AppButton variant="secondary" onPress={() => void services.sessionStorage.clearRefreshToken()}>
                Reset secure session
              </AppButton>
              <AppButton variant="secondary" onPress={() => controller.simulateSecureStoreFailure(!controller.isSecureStoreFailureSimulated())}>
                Simulate SecureStore failure
              </AppButton>
            </>
          ) : null}
        </Surface>
      </View>
    </AppScreen>
  )
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.info}>
      <AppText variant="caption" colour="textSecondary">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  info: {gap: 2},
  panel: {},
  wrap: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
})
