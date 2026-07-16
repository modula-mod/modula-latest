import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {Avatar} from '@/components/primitives/Avatar'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Divider} from '@/components/primitives/Divider'
import {useSession, useSessionActions} from '@/auth/runtime'
import {isDevelopmentBuild} from '@/lib/platform'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {getAccountPanelDestinations} from '@/platform/ui/navigation/account-panel-destinations'
import {useAccountPanel} from '@/platform/ui/navigation/AccountPanelContext'
import {emitAccountPanelEvent} from '@/platform/ui/navigation/account-panel-events'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {DrawerItem} from '@/shell/DrawerItem'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Adaptive account panel:
 * - compact: ModulaSheet (native BottomSheet)
 * - wide: same sheet content (popover/split can refine later)
 * Destinations come from getAccountPanelDestinations() so product-surface
 * expansions can register Marketplace / Lists / Help without forking this file.
 */
export function AdaptiveAccountPanel() {
  const router = useRouter()
  const {width} = useWindowDimensions()
  const {spacing} = useThemeTokens()
  const session = useSession()
  const {signOut} = useSessionActions()
  const {isVisible, state, closeAccountPanel, notifyPresentationDismissed} =
    useAccountPanel()
  const ownerProfile = session.status === 'signedIn' ? session.profile : null
  const compact = width < 768
  const destinations = getAccountPanelDestinations()

  const navigate = (route: string) => {
    closeAccountPanel('route')
    router.push(route as Href)
  }

  return (
    <ModulaSheet
      isPresented={isVisible}
      onDismiss={() => {
        emitAccountPanelEvent('accountPanel.backdrop.press', state, {
          source: 'sheet-dismiss',
        })
        notifyPresentationDismissed('swipe')
      }}
      snapPoints={compact ? ['half', 'full'] : ['full']}
      testID="adaptive-account-panel">
      <ScrollView
        contentContainerStyle={{paddingBottom: spacing[6], gap: spacing[3]}}
        keyboardShouldPersistTaps="handled">
        <AppPressable
          accessibilityLabel="Open profile"
          onPress={() => navigate('/profile')}
          style={[styles.identity, {gap: spacing[3]}]}>
          <Avatar
            name={
              ownerProfile?.displayName ??
              (session.status === 'guest' ? 'Guest' : 'Modula')
            }
            uri={ownerProfile?.avatarUri}
            colour={ownerProfile?.coverColour}
            size={56}
          />
          <View style={styles.identityText}>
            <AppText variant="headline">
              {ownerProfile?.displayName ??
                (session.status === 'guest' ? 'Guest' : 'Sign in to Modula')}
            </AppText>
            <AppText variant="caption" colour="textSecondary">
              {ownerProfile
                ? `@${ownerProfile.handle}`
                : session.status === 'guest'
                  ? 'Browsing public Modula'
                  : 'Local prototype account'}
            </AppText>
          </View>
        </AppPressable>

        {ownerProfile ? (
          <View style={[styles.statsRow, {gap: spacing[4]}]}>
            <AppText variant="caption" colour="textSecondary">
              {ownerProfile.followerCount ?? 0} followers
            </AppText>
            <AppText variant="caption" colour="textSecondary">
              {ownerProfile.followingCount ?? 0} following
            </AppText>
          </View>
        ) : null}

        <Divider />

        <AppText variant="label" colour="textSecondary">
          Primary
        </AppText>
        <View style={{gap: spacing[2]}}>
          {destinations
            .filter(item => !['settings', 'appearance', 'developer', 'help'].includes(item.id))
            .map(item => (
              <DrawerItem
                key={item.id}
                item={item}
                onPress={() => navigate(item.route)}
              />
            ))}
        </View>

        <Divider />

        <AppText variant="label" colour="textSecondary">
          Settings & help
        </AppText>
        <View style={{gap: spacing[2]}}>
          {destinations
            .filter(item => ['appearance', 'settings', 'help', 'developer'].includes(item.id))
            .map(item => (
              <DrawerItem
                key={item.id}
                item={item}
                onPress={() => navigate(item.route)}
              />
            ))}
          <DrawerItem
            item={{
              label: 'Switch account',
              icon: 'switch',
              description: 'Local account switcher Preview',
            }}
            onPress={() => navigate('/account/switcher')}
          />
          <DrawerItem
            item={{
              label: 'Quick appearance',
              icon: 'appearance',
              description: 'Colour mode and accent',
            }}
            onPress={() => navigate('/settings/appearance')}
          />
        </View>

        <Divider />

        {session.status === 'signedIn' ? (
          <ModulaButton
            label="Sign out"
            role="destructive"
            onPress={() => {
              closeAccountPanel('session')
              void signOut()
            }}
          />
        ) : null}

        <AppText variant="caption" colour="textSecondary">
          Modula 0.1.0 · {isDevelopmentBuild() ? 'Development' : 'Local'}
        </AppText>
      </ScrollView>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  statsRow: {
    flexDirection: 'row',
  },
})
