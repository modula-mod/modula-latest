import {useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CANVAS: Array<{id: string; label: string; icon: AppIconName; x: number; y: number}> = [
  {id: 'route', label: 'Route', icon: 'link', x: 24, y: 24},
  {id: 'board', label: 'Board card', icon: 'board', x: 160, y: 36},
  {id: 'tab', label: 'Profile tab', icon: 'profile', x: 48, y: 120},
  {id: 'settings', label: 'Settings', icon: 'settings', x: 180, y: 130},
  {id: 'tool', label: 'Composer tool', icon: 'create', x: 100, y: 210},
  {id: 'auto', label: 'Automation', icon: 'automation', x: 220, y: 220},
]

const CAPABILITIES = [
  'board.card',
  'profile.tab',
  'settings.section',
  'composer.tool',
  'automation.node',
  'search.provider',
]

export function ForgeStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const [selected, setSelected] = useState('route')
  const [caps, setCaps] = useState<string[]>(['board.card', 'profile.tab'])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Forge" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Build modules inside Modula.</AppText>
            <AppText variant="body" colour="textSecondary">
              Visual draft canvas + manifest preview. No package publish or code execution yet.
            </AppText>
          </View>

          <View style={{gap: spacing[2]}}>
            <AppText variant="label">Module name</AppText>
            <TextInput
              value={preferences.forgeDraftName}
              onChangeText={value => {
                void update({forgeDraftName: value})
              }}
              accessibilityLabel="Module draft name"
              placeholder="My Module"
              placeholderTextColor={colours.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                  borderRadius: radius.medium,
                  color: colours.text,
                  paddingHorizontal: spacing[4],
                },
              ]}
            />
          </View>

          <Surface
            variant="contained"
            style={[
              styles.canvas,
              {
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
                height: 300,
              },
            ]}>
            {CANVAS.map(node => {
              const active = selected === node.id
              return (
                <AppPressable
                  key={node.id}
                  accessibilityLabel={node.label}
                  onPress={() => setSelected(node.id)}
                  style={[
                    styles.node,
                    {
                      left: node.x,
                      top: node.y,
                      backgroundColor: active ? colours.accentSubtle : colours.surfaceRaised,
                      borderColor: active ? colours.accent : colours.border,
                      borderRadius: radius.medium,
                      padding: spacing[3],
                      gap: spacing[1],
                    },
                  ]}>
                  <AppIcon name={node.icon} colour={colours.accent} size={16} />
                  <AppText variant="micro">{node.label}</AppText>
                </AppPressable>
              )
            })}
          </Surface>

          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">Capabilities</AppText>
            <View style={[styles.caps, {gap: spacing[2]}]}>
              {CAPABILITIES.map(cap => {
                const on = caps.includes(cap)
                return (
                  <AppPressable
                    key={cap}
                    accessibilityLabel={cap}
                    onPress={() =>
                      setCaps(prev =>
                        on ? prev.filter(item => item !== cap) : [...prev, cap],
                      )
                    }
                    style={[
                      styles.cap,
                      {
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                        borderRadius: radius.round,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'textSecondary'}>
                      {cap}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.manifest,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.medium,
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="label">Manifest preview</AppText>
            <AppText variant="caption" colour="textSecondary">
              {`{
  "id": "digital.modula.${preferences.forgeDraftName.toLowerCase().replace(/\s+/g, '-') || 'module'}",
  "name": "${preferences.forgeDraftName || 'My Module'}",
  "capabilities": ${JSON.stringify(caps)},
  "selectedNode": "${selected}"
}`}
            </AppText>
            <AppText variant="caption" colour="textTertiary">
              Pipeline: Forge → SDK → Fusion → Registry → Marketplace · sandboxed runtime required
            </AppText>
          </Surface>

          <AppButton onPress={() => router.push('/marketplace/module-forge' as Href)}>
            Forge marketplace card
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/modules' as Href)}>
            Modules library
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  canvas: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  node: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
  },
  caps: {flexDirection: 'row', flexWrap: 'wrap'},
  cap: {borderWidth: StyleSheet.hairlineWidth},
  manifest: {borderWidth: StyleSheet.hairlineWidth},
})
