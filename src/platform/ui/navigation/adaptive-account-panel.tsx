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

const SPACE_IDS = new Set([
  'board',
  'saved',
  'messages',
  'marketplace',
  'product',
  'focus',
  'search',
])

const CREATE_IDS = new Set(['forge', 'agents', 'design-lab', 'feature-atlas', 'developer-tools'])

const SYSTEM_IDS = new Set(['appearance', 'settings', 'help', 'developer', 'nft-studio'])

/**
 * Adaptive account panel — Apple-like section hierarchy.
 * Destinations still come from getAccountPanelDestinations() for extensibility.
 */
export function AdaptiveAccountPanel() {
  const router = useRouter()
  const {width} = useWindowDimensions()
  const {spacing, colours, radius} = useThemeTokens()
  const session = useSession()
  const {signOut} = useSessionActions()
  const {isVisible, state, closeAccountPanel, notifyPresentationDismissed} = useAccountPanel()
  const ownerProfile = session.status === 'signedIn' ? session.profile : null
  const compact = width < 768
  const destinations = getAccountPanelDestinations()

  const spaces = destinations.filter(item => SPACE_IDS.has(item.id))
  const create = destinations.filter(item => CREATE_IDS.has(item.id))
  const system = destinations.filter(item => SYSTEM_IDS.has(item.id))
  const leftover = destinations.filter(
    item => !SPACE_IDS.has(item.id) && !CREATE_IDS.has(item.id) && !SYSTEM_IDS.has(item.id),
  )

  const navigate = (route: string) => {
    closeAccountPanel('route')
    router.push(route as Href)
  }

  const renderGroup = (title: string, items: typeof destinations, dense = false) => {
    if (items.length === 0) return null
    return (
      <View style={[styles.group, {gap: spacing[1]}]}>
        <AppText
          variant="caption"
          colour="textTertiary"
          style={{paddingHorizontal: spacing[1], marginBottom: spacing[1]}}>
          {title.toUpperCase()}
        </AppText>
        <View style={[styles.group, {gap: spacing[1]}]}>
          {items.map(item => (
            <DrawerItem
              key={item.id}
              dense={dense}
              item={{label: item.label, icon: item.icon}}
              onPress={() => navigate(item.route)}
            />
          ))}
        </View>
      </View>
    )
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
      snapPoints={compact ? [{fraction: 0.72}, 'full'] : ['full']}
      material="glass"
      testID="adaptive-account-panel">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: spacing[8], gap: spacing[4]},
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <AppPressable
          accessibilityLabel="Open profile"
          onPress={() => navigate('/profile')}
          style={[styles.identity, {gap: spacing[3]}]}>
          <Avatar
            name={
              ownerProfile?.displayName ?? (session.status === 'guest' ? 'Guest' : 'Modula')
            }
            uri={ownerProfile?.avatarUri}
            colour={ownerProfile?.coverColour}
            size={56}
          />
          <View style={styles.identityText}>
            <AppText variant="headline" numberOfLines={1}>
              {ownerProfile?.displayName ??
                (session.status === 'guest' ? 'Guest' : 'Sign in to Modula')}
            </AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              {ownerProfile
                ? `@${ownerProfile.handle}`
                : session.status === 'guest'
                  ? 'Browsing Modula'
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

        <AppPressable
          accessibilityLabel="View profile"
          onPress={() => navigate('/profile')}
          style={[
            styles.profilePill,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderRadius: radius.round,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              alignSelf: 'flex-start',
            },
          ]}>
          <AppText variant="label">View Profile</AppText>
        </AppPressable>

        <Divider />

        {renderGroup('Spaces', spaces)}
        {renderGroup('Create & labs', [...create, ...leftover], true)}
        {renderGroup('System', system, true)}

        <View style={{gap: spacing[1]}}>
          <DrawerItem
            dense
            item={{label: 'Switch account', icon: 'switch'}}
            onPress={() => navigate('/account/switcher')}
          />
          <DrawerItem
            dense
            item={{label: 'Appearance', icon: 'appearance'}}
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

        <AppText variant="micro" colour="textTertiary">
          Modula 0.1.0 · {isDevelopmentBuild() ? 'Development' : 'Local'}
        </AppText>
      </ScrollView>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  group: {
    alignSelf: 'stretch',
    width: '100%',
  },
  identity: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  identityText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 96,
  },
  profilePill: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    alignSelf: 'stretch',
    width: '100%',
  },
  scrollContent: {
    alignSelf: 'stretch',
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
  },
})
