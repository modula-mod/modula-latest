import {StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulePreScreenModel = {
  name: string
  description: string
  longDescription: string
  status: string
  icon: AppIconName
  capability: string
  tags: string[]
}

const PREVIEW_CAPABILITIES = [
  {label: 'Board card', icon: 'board' as AppIconName},
  {label: 'Profile tab', icon: 'profile' as AppIconName},
  {label: 'Settings', icon: 'settings' as AppIconName},
  {label: 'Composer tool', icon: 'create' as AppIconName},
]

/**
 * Marketing / honesty pre-screen for marketplace modules.
 * Does not claim production install until Registry runtime ships.
 */
export function ModulePreScreenHero({module}: {module: ModulePreScreenModel}) {
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const wash =
    scheme === 'dark'
      ? [colours.accentSubtle, colours.surface]
      : [colours.accentSubtle, colours.canvas]

  return (
    <View style={{gap: spacing[4]}}>
      <Surface
        variant="contained"
        style={[styles.hero, {borderRadius: radius.large, overflow: 'hidden'}]}>
        <LinearGradient colors={wash as [string, string]} style={styles.heroWash}>
          <View
            style={[
              styles.icon,
              {
                backgroundColor: colours.surface,
                borderRadius: radius.large,
                borderColor: colours.border,
              },
            ]}>
            <AppIcon name={module.icon} colour={colours.accent} size={32} />
          </View>
          <View style={{gap: spacing[2], flex: 1}}>
            <AppText variant="caption" colour="accent">
              MODULE PRE-SCREEN · {module.status.toUpperCase()}
            </AppText>
            <AppText variant="display">{module.name}</AppText>
            <AppText variant="body" colour="textSecondary">
              {module.description}
            </AppText>
          </View>
        </LinearGradient>
      </Surface>

      <View style={{gap: spacing[2]}}>
        <AppText variant="headline">What this module can register</AppText>
        <View style={[styles.capGrid, {gap: spacing[2]}]}>
          {PREVIEW_CAPABILITIES.map(item => (
            <View
              key={item.label}
              style={[
                styles.capChip,
                {
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                  borderRadius: radius.medium,
                  padding: spacing[3],
                  gap: spacing[2],
                },
              ]}>
              <AppIcon name={item.icon} colour={colours.accent} size={18} />
              <AppText variant="caption">{item.label}</AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={{gap: spacing[2]}}>
        <AppText variant="headline">About</AppText>
        <AppText variant="body" colour="textSecondary">
          {module.longDescription}
        </AppText>
        <AppText variant="caption" colour="textTertiary">
          Capability · {module.capability}
        </AppText>
        <AppText variant="caption" colour="textTertiary">
          Tags · {module.tags.join(' · ')}
        </AppText>
      </View>

      <Surface
        variant="contained"
        style={[
          styles.pipeline,
          {
            gap: spacing[2],
            padding: spacing[4],
            borderRadius: radius.medium,
            backgroundColor: colours.surfaceRaised,
          },
        ]}>
        <AppText variant="label">Delivery pipeline</AppText>
        <AppText variant="caption" colour="textSecondary">
          Forge → SDK → Fusion → Registry → Marketplace
        </AppText>
        <AppText variant="caption" colour="textTertiary">
          Host stays light. Modules ship as packages with permissions — not hardcoded shell features.
          Preview install does not execute untrusted code.
        </AppText>
      </Surface>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroWash: {
    flexDirection: 'row',
    gap: 16,
    padding: 20,
    alignItems: 'center',
  },
  icon: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  capGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  capChip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minWidth: '46%',
  },
  pipeline: {
    borderWidth: StyleSheet.hairlineWidth,
  },
})
