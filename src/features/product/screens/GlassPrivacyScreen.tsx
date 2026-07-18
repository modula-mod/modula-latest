import {useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const LEVELS = [
  {
    id: 'disable-sharing',
    title: '1 · Disable Sharing',
    body: 'Prevents content from being forwarded or exported through normal controls.',
  },
  {
    id: 'protected-chat',
    title: '2 · Protected Chat',
    body: 'Stronger controls for private conversations — limited forward, tighter devices.',
  },
  {
    id: 'vault-chat',
    title: '3 · Vault Chat',
    body: 'Highest protection for communication and storage. Module sandbox required.',
  },
] as const

export function GlassPrivacyScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [level, setLevel] = useState<(typeof LEVELS)[number]['id']>('protected-chat')

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Glass Privacy" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Understandable protection levels.</AppText>
            <AppText variant="body" colour="textSecondary">
              Glass Privacy is product direction Preview — enforcement lands with messaging and Vault
              modules.
            </AppText>
          </View>

          {LEVELS.map(item => {
            const selected = level === item.id
            return (
              <AppPressable
                key={item.id}
                accessibilityLabel={item.title}
                accessibilityState={{selected}}
                onPress={() => setLevel(item.id)}
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
            <AppText variant="label">Selected · {LEVELS.find(l => l.id === level)?.title}</AppText>
            <AppText variant="caption" colour="textSecondary">
              Works with per-module permissions, session devices, and export controls.
            </AppText>
          </Surface>

          <AppButton onPress={() => router.push('/settings/privacy' as Href)}>
            Privacy & Safety
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/messages' as Href)}>
            Messaging preview
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
