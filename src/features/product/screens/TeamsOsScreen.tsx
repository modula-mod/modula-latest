import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ROLES = ['Owner', 'Admin', 'Editor', 'Member', 'Guest']
const SHARED = [
  'Shared Board widgets',
  'Team CRM',
  'Collaborative tasks',
  'Shared files & calendar',
  'Organisation posts',
  'Approval workflows',
]

export function TeamsOsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Teams" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Shared profiles with roles.</AppText>
            <AppText variant="body" colour="textSecondary">
              Teams reuse Profile-OS — not a disconnected second product. Preview surfaces only.
            </AppText>
          </View>

          <View style={[styles.roles, {gap: spacing[2]}]}>
            {ROLES.map(role => (
              <Surface
                key={role}
                variant="contained"
                style={[
                  styles.role,
                  {
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radius.round,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="caption">{role}</AppText>
              </Surface>
            ))}
          </View>

          <View style={{gap: spacing[3]}}>
            {SHARED.map(item => (
              <Surface
                key={item}
                variant="contained"
                style={[
                  styles.row,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppIcon name="teams" colour={colours.accent} size={18} />
                <AppText variant="body">{item}</AppText>
              </Surface>
            ))}
          </View>

          <AppButton onPress={() => router.push('/product/teams' as Href)}>
            Teams capability card
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/profile/os' as Href)}>
            Profile-OS
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  roles: {flexDirection: 'row', flexWrap: 'wrap'},
  role: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
