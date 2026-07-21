import {useState} from 'react'
import {View, StyleSheet} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {AuthField} from '@/auth/screens/AuthScreenPrimitives'
import {useSession} from '@/auth/runtime'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {RepositoryExportJob} from '@/data/repositories/contracts/AuthRepository'

export function AccountExportScreen() {
  const session = useSession()
  const services = useAppServices()
  const {colours, spacing} = useThemeTokens()
  const defaultEmail = session.status === 'signedIn' ? session.account.email : ''
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState(defaultEmail)
  const [reauthed, setReauthed] = useState(false)
  const [job, setJob] = useState<RepositoryExportJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const reauth = async () => {
    setPending(true)
    setError(null)
    try {
      const result = await services.authRepository.signIn({
        email: email.trim().toLowerCase(),
        password,
      })
      services.accessTokenStore.set(result.tokens.accessToken)
      await services.sessionStorage.setSessionBundle({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        sessionId: result.session.sessionId,
        accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
      })
      setPassword('')
      setReauthed(true)
    } catch {
      setError('Re-authenticate with your Modula Account password before exporting.')
    } finally {
      setPending(false)
    }
  }

  const exportRepo = async () => {
    setPending(true)
    setError(null)
    try {
      const created = await services.authRepository.createRepositoryExport()
      setJob(created)
    } catch {
      setError('Export could not be started.')
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Your Data" />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          <AppText variant="display">Export Greenfield Repository</AppText>
          <AppText variant="body" colour="textSecondary">
            Exports package your Greenfield repository with integrity metadata so you can verify the
            archive. Private records remain private — treat the download as sensitive.
          </AppText>
          {!reauthed ? (
            <>
              <AppText variant="caption" colour="textSecondary">
                Re-authenticate before export.
              </AppText>
              <AuthField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={error ?? undefined}
              />
              <AppButton disabled={pending} onPress={() => void reauth()}>
                {pending ? 'Checking' : 'Confirm identity'}
              </AppButton>
            </>
          ) : (
            <>
              <AppButton disabled={pending} onPress={() => void exportRepo()}>
                {pending ? 'Starting export' : 'Start repository export'}
              </AppButton>
              {job ? (
                <View style={{gap: spacing[2]}}>
                  <AppText variant="headline">Export {job.status}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {job.integrityNote}
                  </AppText>
                  {job.downloadUrl ? (
                    <AppText variant="caption" colour="accent">
                      {job.downloadUrl}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
              {error ? (
                <AppText variant="caption" colour="destructive">
                  {error}
                </AppText>
              ) : null}
            </>
          )}
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 40},
  screen: {flex: 1},
})
