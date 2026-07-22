import {View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {ModuleViewRenderer} from '@/features/modules/runtime/module-view-renderer'
import {ModuleErrorBoundary, ModuleErrorState} from '@/features/modules/runtime/module-error-boundary'
import {ModuleLoadingState} from '@/features/modules/runtime/module-loading-state'
import {ModulePermissionGate} from '@/features/modules/runtime/module-permission-gate'
import {resolveModuleRouteView} from '@/features/modules/runtime/module-route-resolver'
import {useModuleDetailQuery, useModuleViewsQuery} from '@/features/modules/hooks'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleHost({moduleId, path}: {moduleId: string; path: string[]}) {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const detail = useModuleDetailQuery(moduleId)
  const views = useModuleViewsQuery(moduleId)

  const openSettings = () => router.push(`/settings/modules/${encodeURIComponent(moduleId)}` as Href)
  const returnToBoard = () => router.push('/board' as Href)

  if (detail.isPending || views.isPending) return <ModuleLoadingState />
  if (!detail.data) {
    return (
      <ModuleErrorState
        title="Module unavailable"
        body="This module is not available from the registry for the current account."
        onRetry={() => { void detail.refetch(); void views.refetch() }}
      />
    )
  }
  if (detail.data.installationState === 'quarantined') {
    return <ModuleErrorState title="Release quarantined" body="This installed release is blocked by Greenfield policy." onOpenSettings={openSettings} />
  }
  if (detail.data.installationState === 'updateAvailable') {
    return <ModuleErrorState title="Update required" body="Review the module update before opening this surface." onOpenSettings={openSettings} />
  }
  if (detail.data.installationState === 'configurationRequired') {
    return <ModuleErrorState title="Configuration required" body="Complete module settings before this surface can run." onOpenSettings={openSettings} />
  }
  if (detail.data.installationState === 'disabled') {
    return <ModuleErrorState title="Module disabled" body="Enable this module from Settings before opening its hosted route." onOpenSettings={openSettings} />
  }
  if (!['enabled', 'installed'].includes(detail.data.installationState)) {
    return (
      <ModuleErrorState
        title="Permission required"
        body="Install and enable this module before opening its hosted route."
        onOpenSettings={() => router.push(`/marketplace/${encodeURIComponent(moduleId)}` as Href)}
      />
    )
  }

  const view = resolveModuleRouteView(views.data ?? [], path)
  if (!view) {
    return (
      <View style={{gap: spacing[3]}}>
        <ModuleErrorState
          title="Module route not found"
          body="The module did not register a compatible view for this route."
          onRetry={() => { void views.refetch() }}
          onOpenSettings={openSettings}
        />
        <ModulaButton label="Return to Board" role="secondary" onPress={returnToBoard} />
      </View>
    )
  }

  return (
    <ModuleErrorBoundary
      fallback={
        <ModuleErrorState
          title="Module failed to load"
          body="This module surface failed inside the hosted renderer. Other Modula surfaces are unaffected."
          onRetry={() => { void views.refetch() }}
          onOpenSettings={openSettings}
        />
      }>
      <ModulePermissionGate available={view.available !== false} reason="Permission required">
        <ModuleViewRenderer moduleId={moduleId} view={view} />
      </ModulePermissionGate>
    </ModuleErrorBoundary>
  )
}
