import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const LEVELS = [
  {
    id: 'disable-sharing' as const,
    title: '1 · Disable Sharing',
    body: 'Prevents content from being forwarded or exported through normal controls.',
  },
  {
    id: 'protected-chat' as const,
    title: '2 · Protected Chat',
    body: 'Stronger controls for private conversations — limited forward, tighter devices.',
  },
  {
    id: 'vault-chat' as const,
    title: '3 · Vault Chat',
    body: 'Highest protection for communication and storage. Module sandbox required.',
  },
]

export function GlassPrivacyScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const {preferences, update} = useProductPreferences()
  const level = preferences.glassPrivacyLevel

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Glass Privacy" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Understandable protection levels.</AppText>
            <AppText variant="body" colour="textSecondary">
              Selection persists locally. Enforcement lands with messaging and Vault modules.
            </AppText>
          </View>

          {LEVELS.map(item => {
            const selected = level === item.id
            return (
              <AppPressable
                key={item.id}
                accessibilityLabel={item.title}
                accessibilityState={{selected}}
                onPress={() => {
                  void update({glassPrivacyLevel: item.id})
                }}
                style={[
                  styles.card,
                  {
                    padding: spacing[4],
                    borderRadius: radius.large,
                    backgroundColor: selected ? colours.accentSubtle : colours.surface,
                    borderColor: selected ? colours.accent : colours.border,
                    gap: spacing[2],
                  },
                ]}>
                <AppText variant="headline">{item.title}</AppText>
                <AppText variant="body" colour="textSecondary">
                  {item.body}
                </AppText>
              </AppPressable>
            )
          })}

          <Surface
            variant="contained"
            style={[
              styles.note,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.medium,
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="label">
              Selected · {LEVELS.find(item => item.id === level)?.title}
            </AppText>
            <AppText variant="caption" colour="textSecondary">
              Saved on device · Messages inbox reflects forward/export and Chat Assist defaults.
            </AppText>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.note,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.medium,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">Enforcement Preview</AppText>
            <AppText variant="body" colour="textSecondary">
              {level === 'vault-chat'
                ? 'Vault Chat: isolated storage foreshadow · verified participants · Chat Assist off · no unapproved AI · modules blocked unless authorised · enhanced audit.'
                : level === 'protected-chat'
                  ? 'Protected Chat: restricted forward · sensitive-content warnings · controlled media save · privacy event logging · optional expiration later.'
                  : 'Disable Sharing: restrict forward/export where enforceable · screenshot limits explained as platform-constrained.'}
            </AppText>
          </Surface>

          <AppButton onPress={() => router.push('/messages' as Href)}>
            Messaging preview
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/chat-assist' as Href)}>
            Chat Assist permissions
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/settings/privacy' as Href)}>
            Privacy & Safety
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  note: {borderWidth: StyleSheet.hairlineWidth},
})
