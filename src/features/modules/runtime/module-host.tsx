import {Platform, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {ModuleViewRenderer} from '@/features/modules/runtime/module-view-renderer'
import {ModuleErrorBoundary, ModuleErrorState} from '@/features/modules/runtime/module-error-boundary'
import {ModuleInstallIdentity} from '@/features/modules/runtime/module-install-identity'
import {ModuleLoadingState} from '@/features/modules/runtime/module-loading-state'
import {ModulePermissionGate} from '@/features/modules/runtime/module-permission-gate'
import {resolveModuleRouteView} from '@/features/modules/runtime/module-route-resolver'
import {adaptMpsFrontendView, resolveMpsFrontendRoute} from '@/features/modules/runtime/mps-frontend-adapter'
import {isInstalledModuleState} from '@/features/modules/identity/installPresentation'
import {useModuleDetailQuery, useModuleFrontendQuery, useModuleHostCompositionQuery, useModuleViewsQuery} from '@/features/modules/hooks'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleHost({moduleId, path}: {moduleId: string; path: string[]}) {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const detail = useModuleDetailQuery(moduleId)
  const frontendEnabled = detail.data?.installationState === 'enabled'
  const frontend = useModuleFrontendQuery(moduleId, frontendEnabled)
  const views = useModuleViewsQuery(moduleId, frontend.data?.source === 'legacy')
  const route = path.join('/')
  const composition = useModuleHostCompositionQuery(moduleId, route, Platform.OS, frontendEnabled)

  const openSettings = () => router.push(`/settings/modules/${encodeURIComponent(moduleId)}` as Href)
  const returnToBoard = () => router.push('/board' as Href)

  if (detail.isPending) return <ModuleLoadingState />
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
  if (detail.data.installationState === 'installed') {
    return <ModuleErrorState title="Module not enabled" body="Enable this module from Settings before opening its product experience." onOpenSettings={openSettings} />
  }
  if (!isInstalledModuleState(detail.data.installationState)) {
    return (
      <ModuleInstallIdentity
        module={detail.data}
        onInstall={() => router.push(`/marketplace/${encodeURIComponent(moduleId)}` as Href)}
      />
    )
  }

  if (frontend.isPending) return <ModuleLoadingState />
  if (frontend.isError || !frontend.data) {
    return (
      <ModuleErrorState
        title="Verified product frontend unavailable"
        body="The active release could not provide a verified, compatible frontend. No legacy or unverified UI was loaded."
        onRetry={() => { void frontend.refetch() }}
        onOpenSettings={openSettings}
      />
    )
  }

  if (frontend.data.source === 'mps' && frontend.data.mode !== 'declarative') {
    return (
      <ModuleErrorState
        title="No standalone product view"
        body="This product contributes to approved host surfaces and does not declare a standalone module route."
        onOpenSettings={openSettings}
      />
    )
  }

  if (frontend.data.source === 'legacy' && views.isPending) return <ModuleLoadingState />
  const resolvedMps = frontend.data.source === 'mps'
    ? resolveMpsFrontendRoute(frontend.data.frontend, path)
    : null
  const view = frontend.data.source === 'mps'
    ? resolvedMps ? adaptMpsFrontendView({frontend: frontend.data.frontend, resolved: resolvedMps}) : null
    : resolveModuleRouteView(views.data ?? [], path)
  if (!view) {
    return (
      <View style={{gap: spacing[3]}}>
        <ModuleErrorState
          title="Module route not found"
          body="The module did not register a compatible view for this route."
          onRetry={() => {
            if (frontend.data.source === 'legacy') void views.refetch()
            else void frontend.refetch()
          }}
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
          onRetry={() => { void frontend.refetch(); if (frontend.data.source === 'legacy') void views.refetch() }}
          onOpenSettings={openSettings}
        />
      }>
      <ModulePermissionGate available={view.available !== false} reason="Permission required">
        <ModuleViewRenderer
          moduleId={moduleId}
          view={view}
          aiActions={detail.data.ai?.productActions ?? []}
          extensionContributions={composition.data?.extensions ?? []}
        />
      </ModulePermissionGate>
    </ModuleErrorBoundary>
  )
}
