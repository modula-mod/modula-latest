import {useEffect, useMemo, useState} from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {BlurBackdrop} from '@/components/materials/BlurBackdrop'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {useSession} from '@/auth/runtime'
import {useDiscoverQuery} from '@/features/discover/data'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {selectionHaptic} from '@/lib/haptics'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type HomeSearchModalProps = {
  visible: boolean
  onClose: () => void
}

type SearchAction = {
  id: string
  label: string
  icon: AppIconName
  href: Href
}

type AccessRole = 'Owner' | 'Can edit' | 'Can view'

const ACTIONS: readonly SearchAction[] = [
  {id: 'discover', label: 'Open Discover', icon: 'discover', href: '/discover'},
  {id: 'compose', label: 'Compose post', icon: 'create', href: '/compose'},
  {id: 'people', label: 'Find people', icon: 'people', href: '/discover'},
  {id: 'communities', label: 'Communities', icon: 'community', href: '/discover'},
  {id: 'saved', label: 'Saved posts', icon: 'saved', href: '/saved'},
  {id: 'presence', label: 'Live Presence', icon: 'play', href: '/discover/live'},
]

/**
 * Glass search modal opened from the Home pull-action tray (Search).
 * Inspired by frosted command panels — Modula actions + people, not a clone.
 */
export function HomeSearchModal({visible, onClose}: HomeSearchModalProps) {
  const router = useRouter()
  const session = useSession()
  const ownerProfileId =
    session.status === 'signedIn' ? session.profile.id : null
  const {colours, spacing, radius, scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const discoverQuery = useDiscoverQuery()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (visible) return undefined
    const id = setTimeout(() => setQuery(''), 0)
    return () => clearTimeout(id)
  }, [visible])

  const people = useMemo(() => {
    const profiles = discoverQuery.data?.suggestedProfiles ?? []
    const roles: AccessRole[] = ['Owner', 'Can edit', 'Can view', 'Can edit', 'Can view']
    const filtered = query.trim()
      ? profiles.filter(profile =>
          (profile.displayName ?? profile.handle ?? '')
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
      : profiles
    return filtered.slice(0, 6).map((profile, index) => ({
      profile,
      role: roles[index % roles.length] ?? 'Can view',
    }))
  }, [discoverQuery.data?.suggestedProfiles, query])

  const actions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ACTIONS
    return ACTIONS.filter(action => action.label.toLowerCase().includes(q))
  }, [query])

  const go = (href: Href) => {
    void selectionHaptic()
    onClose()
    router.push(href)
  }

  const glassTint = scheme === 'dark' ? 'systemMaterialDark' : 'systemMaterialLight'
  // Frosted glass wash — neutral, not accent-tinted or pink-card AI default.
  const panelWash =
    scheme === 'dark' ? 'rgba(18, 24, 28, 0.42)' : 'rgba(255, 255, 255, 0.52)'
  const fieldWash =
    scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.62)'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss search"
          onPress={onClose}
          style={StyleSheet.absoluteFill}>
          {reduceTransparency ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                {backgroundColor: colours.backdrop},
              ]}
            />
          ) : (
            <BlurBackdrop
              intensity={36}
              tint={scheme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              {backgroundColor: colours.backdrop, opacity: 0.35},
            ]}
          />
        </Pressable>

        <View
          style={[styles.panelWrap, {paddingHorizontal: spacing[4]}]}
          pointerEvents="box-none">
          <View style={[styles.panelShell, {borderRadius: radius.xlarge}]}>
            {reduceTransparency ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderRadius: radius.xlarge,
                  },
                ]}
              />
            ) : (
              <>
                <BlurBackdrop
                  intensity={64}
                  tint={glassTint}
                  style={[
                    StyleSheet.absoluteFill,
                    {borderRadius: radius.xlarge},
                  ]}
                />
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: panelWash,
                      borderRadius: radius.xlarge,
                    },
                  ]}
                />
              </>
            )}

            <View
              style={[
                styles.panelBody,
                {
                  borderColor: colours.border,
                  borderRadius: radius.xlarge,
                  gap: spacing[4],
                  padding: spacing[4],
                },
              ]}>
              <View
                style={[
                  styles.searchField,
                  {
                    backgroundColor: fieldWash,
                    borderColor: colours.border,
                    borderRadius: radius.large,
                    gap: spacing[2],
                    paddingHorizontal: spacing[3],
                  },
                ]}>
                <AppIcon name="search" colour={colours.textSecondary} size={18} />
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={colours.textTertiary}
                  accessibilityLabel="Search Modula"
                  returnKeyType="search"
                  style={[styles.searchInput, {color: colours.text}]}
                />
              </View>

              <View style={{gap: spacing[2]}}>
                <AppText variant="caption" colour="textTertiary">
                  Actions
                </AppText>
                {actions.map(action => (
                  <AppPressable
                    key={action.id}
                    accessibilityLabel={action.label}
                    onPress={() => go(action.href)}
                    style={[
                      styles.actionRow,
                      {borderRadius: radius.medium, gap: spacing[3]},
                    ]}>
                    <AppIcon
                      name={action.icon}
                      colour={colours.text}
                      size={20}
                    />
                    <AppText variant="body" style={{flex: 1, color: colours.text}}>
                      {action.label}
                    </AppText>
                    <AppIcon
                      name="chevronRight"
                      colour={colours.textTertiary}
                      size={16}
                    />
                  </AppPressable>
                ))}
                {actions.length === 0 ? (
                  <AppText variant="caption" colour="textTertiary">
                    No matching actions
                  </AppText>
                ) : null}
              </View>

              <View style={{gap: spacing[2]}}>
                <AppText variant="caption" colour="textTertiary">
                  People with access
                </AppText>
                <ScrollView
                  style={styles.peopleScroll}
                  keyboardShouldPersistTaps="handled">
                  {people.map(({profile, role}) => (
                    <AppPressable
                      key={profile.id}
                      accessibilityLabel={`${profile.displayName ?? profile.handle}, ${role}`}
                      onPress={() =>
                        go(
                          getProfileRouteForIdentity(
                            profile,
                            ownerProfileId ?? '',
                          ) as Href,
                        )
                      }
                      style={[
                        styles.personRow,
                        {borderRadius: radius.medium, gap: spacing[3]},
                      ]}>
                      <Avatar
                        name={profile.displayName ?? profile.handle ?? 'Person'}
                        uri={profile.avatarUri}
                        colour={profile.coverColour}
                        size={36}
                      />
                      <AppText
                        variant="body"
                        style={{flex: 1, color: colours.text}}
                        numberOfLines={1}>
                        {profile.displayName ?? profile.handle}
                      </AppText>
                      <AppText variant="caption" colour="textSecondary">
                        {role}
                        {role !== 'Owner' ? ' ▾' : ''}
                      </AppText>
                    </AppPressable>
                  ))}
                  {people.length === 0 ? (
                    <AppText variant="caption" colour="textTertiary">
                      No people to show yet
                    </AppText>
                  ) : null}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  panelBody: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
    zIndex: 1,
  },
  panelShell: {
    maxWidth: 420,
    overflow: 'hidden',
    width: '100%',
  },
  panelWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 48,
  },
  peopleScroll: {
    maxHeight: 220,
  },
  personRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
    paddingVertical: 6,
  },
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  searchField: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 10,
  },
})
