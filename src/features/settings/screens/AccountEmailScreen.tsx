import {View, StyleSheet} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useSession} from '@/auth/runtime'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccountEmailScreen() {
  const session = useSession()
  const {colours, spacing} = useThemeTokens()
  const email = session.status === 'signedIn' ? session.account.email : '—'

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Email" />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[3], padding: spacing[4]}]}>
          <AppText variant="headline">Sign-in email</AppText>
          <AppText variant="bodyStrong">{email}</AppText>
          <AppText variant="caption" colour="textSecondary">
            Email is an authentication identity for your Modula Account. It is not your public handle
            and is not a protocol DID.
          </AppText>
          <AppText variant="caption" colour="textMuted">
            Changing email requires a verified flow that lands with the Greenfield API in a later
            release. Contact support if you need to migrate an address before then.
          </AppText>
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {maxWidth: 560, width: '100%', alignSelf: 'center'},
  screen: {flex: 1},
})
