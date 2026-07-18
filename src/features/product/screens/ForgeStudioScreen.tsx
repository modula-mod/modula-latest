import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  FORGE_CAPABILITIES,
  FORGE_PERMISSIONS,
  FORGE_STEPS,
  buildForgeManifestPreview,
  type ForgeBuilderStep,
  type ForgeCanvasNodeId,
} from '@/features/product/data/forgeDraft'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {selectionHaptic} from '@/lib/haptics'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CANVAS: Array<{
  id: ForgeCanvasNodeId
  label: string
  icon: AppIconName
  x: number
  y: number
}> = [
  {id: 'route', label: 'Route', icon: 'link', x: 20, y: 20},
  {id: 'board', label: 'Board', icon: 'board', x: 150, y: 28},
  {id: 'tab', label: 'Profile tab', icon: 'profile', x: 280, y: 20},
  {id: 'settings', label: 'Settings', icon: 'settings', x: 40, y: 120},
  {id: 'tool', label: 'Composer', icon: 'create', x: 170, y: 130},
  {id: 'auto', label: 'Automation', icon: 'automation', x: 290, y: 120},
  {id: 'agent', label: 'Agent', icon: 'tools', x: 100, y: 220},
  {id: 'widget', label: 'Widget', icon: 'modules', x: 240, y: 220},
]

export function ForgeStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const [step, setStep] = useState<ForgeBuilderStep>('identity')
  const [description, setDescription] = useState('A Modula module draft from Forge Preview.')
  const [repoUrl, setRepoUrl] = useState('https://github.com/modula-mod/my-module')
  const [surfaces, setSurfaces] = useState<ForgeCanvasNodeId[]>(['route', 'board', 'tab'])
  const [caps, setCaps] = useState<string[]>(['board.card', 'profile.tab'])
  const [perms, setPerms] = useState<string[]>(['storage:namespaced', 'profile:read'])
  const [selected, setSelected] = useState<ForgeCanvasNodeId>('route')

  const manifest = useMemo(
    () =>
      buildForgeManifestPreview({
        name: preferences.forgeDraftName,
        description,
        capabilities: caps,
        permissions: perms,
        surfaces,
        repositoryUrl: repoUrl,
      }),
    [caps, description, perms, preferences.forgeDraftName, repoUrl, surfaces],
  )

  const stepIndex = FORGE_STEPS.findIndex(item => item.id === step)

  const goNext = () => {
    const next = FORGE_STEPS[stepIndex + 1]
    if (next) {
      void selectionHaptic()
      setStep(next.id)
    }
  }

  const goBack = () => {
    const prev = FORGE_STEPS[stepIndex - 1]
    if (prev) {
      void selectionHaptic()
      setStep(prev.id)
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Forge Builder" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Build modules inside Modula.</AppText>
            <AppText variant="body" colour="textSecondary">
              Multi-step Forge Preview aligned to GreenfieldModuleManifest. No package publish or
              code execution yet.
            </AppText>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.steps, {gap: spacing[2]}]}>
              {FORGE_STEPS.map((item, index) => {
                const on = item.id === step
                const done = index < stepIndex
                return (
                  <AppPressable
                    key={item.id}
                    accessibilityLabel={`Step ${item.label}`}
                    onPress={() => setStep(item.id)}
                    style={[
                      styles.step,
                      {
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: radius.round,
                        backgroundColor: on
                          ? colours.accentSubtle
                          : done
                            ? colours.surfaceRaised
                            : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'textSecondary'}>
                      {index + 1}. {item.label}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          </ScrollView>

          {step === 'identity' ? (
            <View style={{gap: spacing[3]}}>
              <AppText variant="headline">Module identity</AppText>
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
              <TextInput
                value={description}
                onChangeText={setDescription}
                accessibilityLabel="Module description"
                placeholder="What does this module do?"
                placeholderTextColor={colours.textTertiary}
                multiline
                style={[
                  styles.input,
                  styles.multiline,
                  {
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    borderRadius: radius.medium,
                    color: colours.text,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                  },
                ]}
              />
              <TextInput
                value={repoUrl}
                onChangeText={setRepoUrl}
                accessibilityLabel="Repository URL"
                placeholder="https://github.com/…"
                placeholderTextColor={colours.textTertiary}
                autoCapitalize="none"
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
          ) : null}

          {step === 'surfaces' ? (
            <View style={{gap: spacing[3]}}>
              <AppText variant="headline">Contribution surfaces</AppText>
              <AppText variant="body" colour="textSecondary">
                Tap canvas nodes to include them in the draft manifest.
              </AppText>
              <Surface
                variant="contained"
                style={[
                  styles.canvas,
                  {
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    height: 320,
                  },
                ]}>
                {CANVAS.map(node => {
                  const on = surfaces.includes(node.id)
                  const active = selected === node.id
                  return (
                    <AppPressable
                      key={node.id}
                      accessibilityLabel={`${on ? 'Remove' : 'Add'} ${node.label}`}
                      onPress={() => {
                        setSelected(node.id)
                        setSurfaces(prev =>
                          on ? prev.filter(id => id !== node.id) : [...prev, node.id],
                        )
                      }}
                      style={[
                        styles.node,
                        {
                          left: node.x,
                          top: node.y,
                          backgroundColor: on ? colours.accentSubtle : colours.surfaceRaised,
                          borderColor: active || on ? colours.accent : colours.border,
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
            </View>
          ) : null}

          {step === 'permissions' ? (
            <View style={{gap: spacing[4]}}>
              <View style={{gap: spacing[2]}}>
                <AppText variant="headline">Capabilities</AppText>
                <View style={[styles.chips, {gap: spacing[2]}]}>
                  {FORGE_CAPABILITIES.map(cap => {
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
                          styles.chip,
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
              <View style={{gap: spacing[2]}}>
                <AppText variant="headline">Permissions</AppText>
                <View style={[styles.chips, {gap: spacing[2]}]}>
                  {FORGE_PERMISSIONS.map(perm => {
                    const on = perms.includes(perm)
                    return (
                      <AppPressable
                        key={perm}
                        accessibilityLabel={perm}
                        onPress={() =>
                          setPerms(prev =>
                            on ? prev.filter(item => item !== perm) : [...prev, perm],
                          )
                        }
                        style={[
                          styles.chip,
                          {
                            backgroundColor: on ? colours.accentSubtle : colours.surface,
                            borderColor: on ? colours.accent : colours.border,
                            borderRadius: radius.round,
                            paddingHorizontal: spacing[3],
                            paddingVertical: spacing[2],
                          },
                        ]}>
                        <AppText variant="caption" colour={on ? 'accent' : 'textSecondary'}>
                          {perm}
                        </AppText>
                      </AppPressable>
                    )
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {step === 'manifest' || step === 'publish' ? (
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
              <AppText variant="label">
                {step === 'publish' ? 'Publish preview' : 'Manifest preview'}
              </AppText>
              <AppText variant="caption" colour="textSecondary">
                {manifest}
              </AppText>
              {step === 'publish' ? (
                <AppText variant="caption" colour="textTertiary">
                  Pipeline: Forge → SDK → Fusion → Registry → Marketplace. Sandboxed runtime
                  required. This build does not publish packages or execute module code.
                </AppText>
              ) : null}
            </Surface>
          ) : null}

          <View style={[styles.nav, {gap: spacing[2]}]}>
            <AppButton variant="secondary" onPress={goBack} disabled={stepIndex === 0}>
              Back
            </AppButton>
            {stepIndex < FORGE_STEPS.length - 1 ? (
              <AppButton onPress={goNext}>Continue</AppButton>
            ) : (
              <AppButton
                onPress={() => router.push('/marketplace/module-forge' as Href)}
                variant="secondary">
                Forge marketplace card
              </AppButton>
            )}
          </View>

          <AppButton variant="ghost" onPress={() => router.push('/modules' as Href)}>
            Modules library
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/agents' as Href)}>
            Agents module studio
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  steps: {flexDirection: 'row'},
  step: {borderWidth: StyleSheet.hairlineWidth},
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  multiline: {minHeight: 96, textAlignVertical: 'top'},
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
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: StyleSheet.hairlineWidth},
  manifest: {borderWidth: StyleSheet.hairlineWidth},
  nav: {flexDirection: 'row', flexWrap: 'wrap'},
})
