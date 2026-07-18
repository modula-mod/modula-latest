import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Shared Preview renderer for optional module-contributed profile tabs
 * (Shop, Agents, …) until external packages register real renderers.
 */
export function PreviewModuleProfileTab({profile}: ProfileTabRendererProps) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <ScrollView contentContainerStyle={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
      <Surface
        variant="contained"
        style={[
          styles.card,
          {
            padding: spacing[4],
            gap: spacing[3],
            borderRadius: radius.large,
            backgroundColor: colours.surface,
            borderColor: colours.border,
          },
        ]}>
        <AppIcon name="modules" colour={colours.accent} />
        <AppText variant="headline">Module tab · Preview</AppText>
        <AppText variant="body" colour="textSecondary">
          This tab slot is reserved for an installable module on {profile.displayName}’s Profile-OS.
          External packages register real content via Greenfield manifests — the host does not hardcode
          product modules here.
        </AppText>
        <AppButton onPress={() => router.push('/product/forge' as Href)}>Open Forge Builder</AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/modules' as Href)}>
          Modules library
        </AppButton>
        <AppButton variant="ghost" onPress={() => router.push('/profile/customize' as Href)}>
          Customize tabs
        </AppButton>
      </Surface>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {paddingBottom: 40},
  card: {borderWidth: StyleSheet.hairlineWidth},
})
