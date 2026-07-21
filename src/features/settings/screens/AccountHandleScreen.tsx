import {useState} from 'react'
import {View, StyleSheet} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {useSession} from '@/auth/runtime'
import {AuthField} from '@/auth/screens/AuthScreenPrimitives'
import {normaliseHandle, validateHandle} from '@/features/profile/utils/validators'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccountHandleScreen() {
  const session = useSession()
  const services = useAppServices()
  const {colours, spacing} = useThemeTokens()
  const current =
    session.status === 'signedIn' ? session.greenfieldAccount.primaryHandle : ''
  const accountId = session.status === 'signedIn' ? session.greenfieldAccount.accountId : ''
  const [handle, setHandle] = useState(current)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    const normalised = normaliseHandle(handle)
    const valid = validateHandle(normalised)
    if (!valid.valid) {
      setError(valid.message)
      return
    }
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const result = await services.authRepository.changeHandle(normalised)
      setHandle(result.handle)
      setMessage(
        `Handle updated to @${result.handle}. Your account ID is unchanged — ownership, followers, repository, modules, and future DIMON linkage stay with this account.`,
      )
      void result.accountId
    } catch {
      setError('That handle is unavailable.')
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Handle" />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          <AppText variant="caption" colour="textSecondary">
            Public handle only. Account ID never changes when you rename.
          </AppText>
          <AuthField
            label="Handle"
            value={handle}
            onChangeText={value => setHandle(normaliseHandle(value))}
            autoCapitalize="none"
            error={error ?? undefined}
          />
          <AppText variant="caption" colour="textMuted">
            Account ID is internal and not shown on your public profile.
          </AppText>
          <AppButton disabled={pending || session.status !== 'signedIn'} onPress={() => void submit()}>
            {pending ? 'Saving' : 'Save handle'}
          </AppButton>
          {message ? (
            <AppText variant="caption" colour="textSecondary">
              {message}
            </AppText>
          ) : null}
          {accountId ? (
            <AppText variant="caption" colour="textMuted">
              Internal reference retained after rename.
            </AppText>
          ) : null}
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {maxWidth: 560, width: '100%', alignSelf: 'center'},
  screen: {flex: 1},
})
