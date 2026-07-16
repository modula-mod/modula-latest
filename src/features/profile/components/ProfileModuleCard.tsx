import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {ProfileModulePreview} from '@/features/profile/data/demoProfileModules'
import {ProfileVisibilityBadge} from '@/features/profile/components/ProfileVisibilityBadge'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaControlGroup} from '@/platform/ui/menus/modula-control-group'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileModuleCardProps = {
  module: ProfileModulePreview
}

const statusLabels: Record<ProfileModulePreview['status'], string> = {
  featured: 'Featured',
  available: 'Available',
  preview: 'Preview',
}

function marketplaceRouteForModule(module: ProfileModulePreview): Href {
  const normalized = module.name.trim().toLowerCase()
  if (normalized.includes('task')) return '/marketplace/module-tasks' as Href
  if (normalized.includes('vault')) return '/marketplace/module-vault-notes' as Href
  return '/marketplace' as Href
}

export function ProfileModuleCard({module}: ProfileModuleCardProps) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const route = marketplaceRouteForModule(module)

  const open = () => router.push(route)

  return (
    <ModulaContextMenu
      accessibilityLabel={`${module.name} module actions`}
      actions={[
        {id: 'open', label: 'Open'},
        {id: 'preview', label: 'Preview'},
        {id: 'pin', label: 'Pin to Board'},
        {id: 'share', label: 'Share preview'},
      ]}
      onAction={id => {
        if (id === 'open' || id === 'preview') open()
        if (id === 'pin') router.push('/board' as Href)
      }}>
      <AppPressable accessibilityLabel={`Open ${module.name}`} onPress={open}>
        <Surface
          variant="contained"
          style={[styles.card, {gap: spacing[3], padding: spacing[3]}]}>
          <View
            style={[
              styles.icon,
              {backgroundColor: colours.accentSubtle, borderRadius: radius.medium},
            ]}>
            <AppIcon name={module.icon} colour={colours.accent} />
          </View>
          <View style={styles.body}>
            <View style={[styles.titleRow, {gap: spacing[2]}]}>
              <AppText variant="headline" numberOfLines={1} style={styles.title}>
                {module.name}
              </AppText>
              <AppText variant="caption" colour="accent">
                {statusLabels[module.status]}
              </AppText>
            </View>
            <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
              {module.description}
            </AppText>
          </View>
          <View style={styles.footer}>
            <ProfileVisibilityBadge
              visibility={module.visibility}
              contextLabel={`${module.name} module`}
            />
            <ModulaControlGroup
              label="Module"
              actions={[
                {id: 'open', label: 'Open', systemImage: 'arrow.up.right'},
                {id: 'preview', label: 'Preview', systemImage: 'eye'},
                {id: 'pin', label: 'Pin', systemImage: 'pin'},
              ]}
              onAction={id => {
                if (id === 'open' || id === 'preview') open()
                if (id === 'pin') router.push('/board' as Href)
              }}
            />
          </View>
        </Surface>
      </AppPressable>
    </ModulaContextMenu>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  card: {
    minHeight: 112,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  icon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
