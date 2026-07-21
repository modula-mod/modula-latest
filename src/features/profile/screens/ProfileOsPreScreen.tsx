import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {LinearGradient} from 'expo-linear-gradient'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {PresenceArc} from '@/features/onboarding/components/PresenceArc'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const SURFACES = [
  {
    title: 'Visitor presentation',
    body:
      'Visitors see the identity, posts, links, modules, and tabs you choose to publish. Private controls stay out of the public profile.',
  },
  {
    title: 'Owner workspace',
    body:
      'You keep your daily OS behind the profile: modules, widgets, focus controls, drafts, and quick actions that visitors cannot operate.',
  },
  {
    title: 'Custom tabs',
    body:
      'Core tabs sit beside Preview slots for Shop and Agents. Real packages still need Registry installs before those slots become active modules.',
  },
  {title: 'Installed modules', body: 'CRM, Notes, Tasks, and more appear as tabs and cards.'},
  {
    title: 'Focus Halo',
    body:
      'A small availability ring around the avatar explains whether you are available, focused, busy, or offline before someone interrupts you.',
  },
  {
    title: 'Privacy levels',
    body: 'Each surface can stay public, private, team-only, or limited to selected audiences.',
  },
]

/**
 * Profile-OS pre-screen — product pitch for profile-as-platform.
 */
export function ProfileOsPreScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Profile-OS" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              gap: spacing[5],
              padding: spacing[4],
              paddingBottom: insets.bottom + spacing[8],
            },
          ]}
          showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[styles.hero, {borderRadius: radius.large, padding: spacing[5], gap: spacing[3]}]}>
            <AppText variant="caption" colour="accent">
              PROFILE BECOMES PLATFORM
            </AppText>
            <AppText variant="display">Build a digital environment around your identity.</AppText>
            <AppText variant="body" colour="textSecondary">
              Most apps give everyone the same shell. Modula separates the profile visitors see from
              the workspace owners use, so modules, widgets, themes, and tools can stay precise.
            </AppText>
          </LinearGradient>

          <PresenceArc
            centreLabel="Focus Halo"
            items={[
              {id: 'social', label: 'Social', icon: 'home'},
              {id: 'board', label: 'Board', icon: 'board', unread: true},
              {id: 'you', label: 'You', icon: 'profile', unread: true},
              {id: 'mods', label: 'Modules', icon: 'modules'},
              {id: 'team', label: 'Teams', icon: 'teams'},
            ]}
          />

          <View style={{gap: spacing[3]}}>
            {SURFACES.map(item => (
              <Surface
                key={item.title}
                variant="contained"
                style={[
                  styles.card,
                  {
                    gap: spacing[2],
                    padding: spacing[4],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <View style={[styles.cardTitle, {gap: spacing[2]}]}>
                  <AppIcon name="check" colour={colours.accent} size={18} />
                  <AppText variant="headline">{item.title}</AppText>
                </View>
                <AppText variant="body" colour="textSecondary">
                  {item.body}
                </AppText>
              </Surface>
            ))}
          </View>

          <View style={{gap: spacing[3]}}>
            <AppButton onPress={() => router.push('/profile/customize' as Href)}>
              Customize tabs & layout
            </AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/product/themes' as Href)}>
              Themes & layout packs
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/product/agents' as Href)}>
              Agents profile tab
            </AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/product/intelligence' as Href)}>
              Intelligence Hub
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/product/nft' as Href)}>
              NFT Studio (inactive)
            </AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/marketplace' as Href)}>
              Browse modules
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/profile/preview' as Href)}>
              View as visitor
            </AppButton>
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
  },
  hero: {
    width: '100%',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
