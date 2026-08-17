import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {SkeletonBlock} from '@/platform/ui/skeletons'
import type {ProfileModulePreview} from '@/features/profile/contracts/profileModules'
import type {ProfileViewerContext} from '@/features/profile/contracts/profile'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileModulesPreviewProps = {
  modules: ProfileModulePreview[]
  viewer: ProfileViewerContext
  loading?: boolean
  failed?: boolean
  onViewAll: () => void
}

/**
 * Compact snapshot of public modules. The lower Modules tab remains the
 * full destination — this page only answers what this profile exposes.
 */
export function ProfileModulesPreview({
  modules,
  viewer,
  loading,
  failed,
  onViewAll,
}: ProfileModulesPreviewProps) {
  const {colours, spacing} = useThemeTokens()
  const {fontScale} = useWindowDimensions()
  const twoColumn = fontScale < PROFILE_LAYOUT.stackedFontScale

  if (loading) {
    return (
      <View style={[styles.host, {gap: spacing[2]}]} testID="profile-modules-preview">
        <SkeletonBlock height={12} width="62%" />
        <View style={[styles.grid, twoColumn ? styles.gridTwo : null, {gap: spacing[2]}]}>
          <SkeletonBlock height={40} width={twoColumn ? '48%' : '100%'} />
          <SkeletonBlock height={40} width={twoColumn ? '48%' : '100%'} />
        </View>
      </View>
    )
  }

  if (failed && !modules.length) {
    return (
      <View style={[styles.host, {gap: spacing[2]}]} testID="profile-modules-preview">
        <AppText variant="caption" colour="textSecondary">
          Modules could not be loaded.
        </AppText>
      </View>
    )
  }

  if (!modules.length) {
    return (
      <View style={[styles.host, {gap: spacing[2]}]} testID="profile-modules-preview">
        <AppText variant="body" colour="textSecondary">
          No public modules yet.
        </AppText>
        {viewer.relationship === 'owner' ? (
          <PreviewCta label="Customize modules" onPress={onViewAll} />
        ) : null}
      </View>
    )
  }

  return (
    <View style={[styles.host, {gap: spacing[2]}]} testID="profile-modules-preview">
      <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
        Modules powering this profile
      </AppText>
      <View style={[styles.grid, twoColumn ? styles.gridTwo : null, {gap: spacing[2]}]}>
        {modules.map(module => (
          <ModulePreviewTile key={module.id} module={module} stacked={!twoColumn} />
        ))}
      </View>
      <PreviewCta label="View all modules" onPress={onViewAll} colour={colours.accent} />
    </View>
  )
}

function ModulePreviewTile({
  module,
  stacked,
}: {
  module: ProfileModulePreview
  stacked: boolean
}) {
  return (
    <View
      style={[styles.tile, stacked ? styles.tileFull : styles.tileHalf]}
      testID={`profile-module-preview-${module.id}`}>
      <AppText variant="label" numberOfLines={1}>
        {module.name}
      </AppText>
      <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
        {module.description}
      </AppText>
    </View>
  )
}

function PreviewCta({
  label,
  onPress,
  colour,
}: {
  label: string
  onPress: () => void
  colour?: string
}) {
  const {colours} = useThemeTokens()
  const router = useRouter()
  const ownerCustomize = label === 'Customize modules'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="profile-snapshot-cta-modules"
      hitSlop={8}
      onPress={() => {
        if (ownerCustomize) {
          router.push('/profile/customize' as Href)
          return
        }
        onPress()
      }}
      style={styles.cta}>
      <AppText variant="label" colour="accent" numberOfLines={1}>
        {label}
      </AppText>
      <ModulaIcon name="chevronRight" colour={colour ?? colours.accent} size={12} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  cta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 32,
  },
  grid: {
    minWidth: 0,
    width: '100%',
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  host: {
    minWidth: 0,
    width: '100%',
  },
  tile: {
    gap: 2,
    minWidth: 0,
    paddingVertical: 4,
  },
  tileFull: {
    width: '100%',
  },
  tileHalf: {
    width: '50%',
    paddingRight: 10,
  },
})
