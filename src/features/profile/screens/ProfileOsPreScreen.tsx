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
  {title: 'Public identity', body: 'Posts, bio, links, and the tabs you choose to share.'},
  {title: 'Private Board', body: 'Your daily OS — modules, widgets, focus, and quick actions.'},
  {title: 'Installed modules', body: 'CRM, Notes, Tasks, and more appear as tabs and cards.'},
  {title: 'Privacy levels', body: 'Public, private, team, or selected audiences per surface.'},
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
              Most apps give everyone the same shell. Modula lets each person construct a different
              environment from modules, widgets, themes, and tools.
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
              Customize your profile
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
