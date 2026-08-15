import type {ReactNode} from 'react'
import {useState} from 'react'
import {ScrollView, StyleSheet, View, Alert} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {InstallPreviewSheet, ModuleInstallProgress} from '@/features/modules/components'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import type {ModuleInstallStageId} from '@/features/modules/components/ModuleInstallProgress'
import {useModuleDetailQuery} from '@/features/modules/hooks'
import type {ModuleDetail, ModuleInstallPreview, ModuleInstallationState} from '@/data/repositories/contracts'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleDetailScreen() {
  const {moduleId} = useLocalSearchParams<{moduleId: string}>()
  const id = String(moduleId ?? '')
  const router = useRouter()
  const services = useAppServices()
  const {colours, radius, spacing} = useThemeTokens()
  const detail = useModuleDetailQuery(id)
  const module = detail.data
  const [preview, setPreview] = useState<ModuleInstallPreview | null>(null)
  const [installSheetOpen, setInstallSheetOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [installStage, setInstallStage] = useState<ModuleInstallStageId | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [technicalOpen, setTechnicalOpen] = useState(false)

  const openPreview = async () => {
    if (!module) return
    setBusy('review')
    try {
      setPreview(await services.moduleRepository.installPreview(module.moduleId, module.latestVersion ?? undefined))
      setInstallSheetOpen(true)
    } catch (error) {
      Alert.alert(
        'Install preview unavailable',
        error instanceof Error ? error.message : 'Could not load install preview for this module.',
      )
    } finally {
      setBusy(null)
    }
  }

  const install = async (enable: boolean) => {
    if (!module) return
    setBusy(enable ? 'install-enable' : 'install')
    setInstallError(null)
    setInstallStage('resolving')
    try {
      const nextPreview = preview ?? await services.moduleRepository.installPreview(module.moduleId, module.latestVersion ?? undefined)
      setPreview(nextPreview)
      setInstallStage('validating')
      if (nextPreview.compatible === false) {
        throw new Error(nextPreview.incompatibilityReasons.join(', ') || 'This module is not compatible.')
      }
      setInstallStage('compatibility')
      setInstallStage('permissions')
      await services.moduleRepository.install(module.moduleId, {version: module.latestVersion ?? undefined})
      setInstallStage('installing')
      if (enable) {
        await services.moduleRepository.enable(module.moduleId)
        setInstallStage('enabling')
      }
      setInstallStage('ready')
      setInstallSheetOpen(false)
      await detail.refetch()
    } catch (error) {
      setInstallStage('failed')
      const message = error instanceof Error ? error.message : 'Registry install did not complete. Check Product Hub and try again.'
      setInstallError(message)
      Alert.alert('Install failed', message)
    } finally {
      setBusy(null)
    }
  }

  const transition = async (kind: 'enable' | 'disable' | 'update' | 'uninstall') => {
    if (!module) return
    if (kind === 'disable') {
      const confirmed = await confirmModulaAction({
        title: 'Disable module',
        message: `${module.name} contributions will stop running, but retained data remains available for re-enable.`,
        confirmLabel: 'Disable module',
        cancelLabel: 'Cancel',
      })
      if (!confirmed) return
    }
    if (kind === 'uninstall') {
      const confirmed = await confirmModulaAction({
        title: 'Uninstall module',
        message: 'The default action keeps module data for a future reinstall. Delete-data uninstall is available from Settings.',
        confirmLabel: 'Uninstall and keep data',
        cancelLabel: 'Cancel',
        destructive: true,
      })
      if (!confirmed) return
    }
    setBusy(kind)
    try {
      if (kind === 'enable') await services.moduleRepository.enable(module.moduleId)
      if (kind === 'disable') await services.moduleRepository.disable(module.moduleId)
      if (kind === 'update') await services.moduleRepository.update(module.moduleId)
      if (kind === 'uninstall') await services.moduleRepository.uninstall(module.moduleId, 'keepData')
      await detail.refetch()
    } catch (error) {
      Alert.alert(
        'Module action failed',
        error instanceof Error ? error.message : 'The registry rejected this module action.',
      )
    } finally {
      setBusy(null)
    }
  }

  if (detail.isPending) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Module" />
        <EmptyState
          icon="modules"
          title="Loading module"
          description="Resolving registry metadata, install state and publisher trust."
        />
      </View>
    )
  }

  if (!module) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Module" />
        <EmptyState
          icon="marketplace"
          title="Module unavailable"
          description="This registry item is not available for the current account."
          action={<ModulaButton label="Return to Product Hub" role="secondary" onPress={() => router.push('/product' as Href)} />}
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={module.name} />
      <ResponsiveContent maxWidth={780}>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <Surface
            variant="contained"
            style={[
              styles.hero,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.large,
                gap: spacing[4],
                padding: spacing[5],
              },
            ]}>
            <View style={styles.heroHeader}>
              <ModuleArtwork moduleId={module.moduleId} name={module.name} size={88} variant="hero" />
              <View style={styles.flex}>
                <AppText variant="display">{module.name}</AppText>
                <AppText variant="body" colour="textSecondary">{module.publisherName}</AppText>
              </View>
            </View>
            <AppText variant="body" colour="textSecondary">{module.longDescription || module.description}</AppText>
            {installStage && installStage !== 'ready' ? (
              <ModuleInstallProgress
                productName={module.name}
                stage={installStage}
                failed={installError}
                onOpen={() => router.push(`/module/${encodeURIComponent(module.moduleId)}` as Href)}
              />
            ) : (
              <ActionRow
                state={module.installationState}
                busy={busy}
                moduleId={module.moduleId}
                installable={module.installable}
                latestVersion={module.latestVersion}
                priceState={module.priceState}
                onPreview={openPreview}
                onOpen={() => router.push(`/module/${encodeURIComponent(module.moduleId)}` as Href)}
                onSettings={() => router.push(`/settings/modules/${encodeURIComponent(module.moduleId)}` as Href)}
                onEnable={() => void transition('enable')}
                onDisable={() => void transition('disable')}
                onUpdate={() => void transition('update')}
                onUninstall={() => void transition('uninstall')}
              />
            )}
          </Surface>

          <Section title="What this module does">
            <AppText variant="body" colour="textSecondary">{module.description}</AppText>
          </Section>
          <Section title="Privacy & data">
            <AppText variant="body" colour="textSecondary">
              {module.privacy ?? 'Your data remains yours. Records stay account-scoped and permission-gated.'}
            </AppText>
          </Section>
          <Section title="Permissions">
            {module.permissions.length ? (
              module.permissions.map(permission => (
                <AppText key={permission.permission} variant="body" colour="textSecondary">
                  • {permission.reason}
                </AppText>
              ))
            ) : (
              <AppText variant="caption" colour="textSecondary">No permissions declared for the selected release state.</AppText>
            )}
          </Section>
          <Section title="What's new">
            {(module.releaseNotes ?? []).length ? (
              module.releaseNotes?.map(note => (
                <AppText key={note} variant="caption" colour="textSecondary">{note}</AppText>
              ))
            ) : (
              <AppText variant="caption" colour="textSecondary">Version {module.latestVersion ?? 'unreleased'}.</AppText>
            )}
          </Section>
          <Section title="Version">
            <InfoRow label="Version" value={module.latestVersion ?? 'Unreleased'} />
            <InfoRow label="Availability" value={resolveModuleInstallPresentation(module).customerStatus} />
          </Section>
          <ModulaButton
            label={technicalOpen ? 'Hide Trust & Technical Details' : 'Trust & Technical Details >'}
            role="plain"
            accessibilityLabel="Toggle trust and technical details"
            onPress={() => setTechnicalOpen(open => !open)}
          />
          {technicalOpen ? (
            <>
          <Section title="Publisher">
            <InfoRow label="Publisher" value={module.publisherName} />
            <InfoRow label="Publisher ID" value={module.publisherId} />
            <InfoRow label="Trust" value={module.trustLevel} />
          </Section>
          <Section title="Backend">
            <InfoRow label="Mode" value={backendModeLabel(module.backend.mode)} />
            <InfoRow label="Provider" value={module.backend.provider} />
            <InfoRow label="Deployment" value={ownershipLabel(module.backend.deploymentOwnership)} />
            <InfoRow label="Endpoint" value={module.backend.endpoint ?? 'Resolved during installation'} />
            <InfoRow label="Protocol" value={module.backend.protocolVersion ?? 'Not required'} />
            <InfoRow label="Status" value={statusLabel(module.backend.status)} />
            <InfoRow label="Self-hosting" value={module.backend.selfHostingSupported ? 'Supported' : 'Not supported'} />
            <InfoRow label="External data processing" value={module.backend.externalDataProcessing ? 'Yes' : 'No'} />
          </Section>
          <Section title="Data location">
            <InfoRow label="Primary store" value={dataLocationLabel(module.backend.dataLocation)} />
            <InfoRow label="Regions" value={module.backend.regions.length ? module.backend.regions.join(', ') : 'Not declared'} />
          </Section>
          {module.standard ? (
            <Section title="Module standard">
              <InfoRow label="Manifest" value={module.standard.manifestVersion ? `Greenfield v${module.standard.manifestVersion}` : 'Not declared'} />
              <InfoRow label="Standard" value={module.standard.standardVersion ?? 'Legacy'} />
              <InfoRow label="Section versions" value={String(Object.keys(module.standard.sectionVersions).length)} />
              <InfoRow label="Dependencies" value={standardDependencySummary(module)} />
              <InfoRow label="Registries" value={standardRegistrySummary(module)} />
              <InfoRow label="Capabilities" value={standardCapabilitySummary(module)} />
              <InfoRow label="Engines" value={module.standard.engines.length ? module.standard.engines.join(', ') : 'Declarative host runtime'} />
            </Section>
          ) : null}
          {module.standard?.runtimeSupport ? (
            <Section title="Runtime support">
              <InfoRow label="Supported sections" value={runtimeSupportCount(module, 'SUPPORTED')} />
              <InfoRow label="Partial sections" value={runtimeSupportCount(module, 'PARTIALLY_SUPPORTED')} />
              <InfoRow label="Declarative-only sections" value={runtimeSupportCount(module, 'DECLARATIVE_ONLY')} />
              <InfoRow label="Unsupported sections" value={runtimeSupportCount(module, 'UNSUPPORTED')} />
              <InfoRow label="Service invocation depth" value={String(module.standard.runtimeSupport.maximumServiceInvocationDepth)} />
              <InfoRow label="Declared but not fully operational" value={runtimeDiagnosticSummary(module)} />
            </Section>
          ) : null}
          {module.standard && hasRegistryMetadata(module) ? (
            <Section title="Services and APIs">
              <InfoRow label="Services" value={registryPreview(module.serviceRegistry, 'kind')} />
              <InfoRow label="APIs" value={apiRegistryPreview(module.apiRegistry)} />
              <InfoRow label="Hooks" value={registryPreview(module.hookRegistry, 'hook')} />
              <InfoRow label="Events" value={registryPreview(module.eventBus, 'type')} />
            </Section>
          ) : null}
          <Section title="Trust and provenance">
            <InfoRow label="Module ID" value={module.moduleId} />
            <InfoRow label="Source repository" value={module.sourceRepository || 'Not declared'} />
            <InfoRow label="Source commit" value={module.sourceCommit || 'Not declared'} />
            <InfoRow label="Manifest checksum" value={module.manifestChecksum || 'Pending'} />
            <InfoRow label="Release checksum" value={module.releaseChecksum || 'Pending'} />
          </Section>
          <Section title="Screens and contributions">
            <AppText variant="caption" colour="textSecondary">{summariseObject(module.contributions)}</AppText>
          </Section>
          <Section title="Declared permission keys">
            <PermissionGroup title="Platform permissions" permissions={platformPermissions(module)} />
            <PermissionGroup title="Module backend permissions" permissions={backendPermissions(module)} />
            <PermissionGroup title="External service permissions" permissions={externalPermissions(module)} />
          </Section>
          <Section title="Data access">
            <AppText variant="caption" colour="textSecondary">
              Records are account-scoped, schema-validated and permission-gated by collection. Raw SQL, arbitrary filters and cross-module queries are rejected by the Greenfield runtime.
            </AppText>
          </Section>
          <Section title="Compatibility">
            <InfoRow label="Version" value={module.latestVersion ?? 'Unreleased'} />
            <InfoRow label="Compatibility" value={module.compatibility} />
            <InfoRow label="Distribution" value={module.priceState} />
          </Section>
            </>
          ) : null}
        </ScrollView>
      </ResponsiveContent>

      <InstallPreviewSheet
        module={module}
        preview={preview}
        isPresented={installSheetOpen}
        pending={Boolean(busy)}
        onDismiss={() => setInstallSheetOpen(false)}
        onInstall={() => void install(false)}
        onInstallAndEnable={() => void install(true)}
      />
    </View>
  )
}

function ActionRow({
  state,
  busy,
  moduleId,
  installable,
  latestVersion,
  priceState,
  onPreview,
  onOpen,
  onSettings,
  onEnable,
  onDisable,
  onUpdate,
  onUninstall,
}: {
  state: ModuleInstallationState
  busy: string | null
  moduleId: string
  installable: boolean
  latestVersion?: string | null
  priceState?: ModuleDetail['priceState']
  onPreview: () => void
  onOpen: () => void
  onSettings: () => void
  onEnable: () => void
  onDisable: () => void
  onUpdate: () => void
  onUninstall: () => void
}) {
  const {spacing} = useThemeTokens()
  const presentation = resolveModuleInstallPresentation({
    moduleId,
    installable,
    installationState: state,
    priceState,
    latestVersion,
  })
  const installed = ['installed', 'enabled', 'disabled', 'updateAvailable', 'configurationRequired'].includes(state)
  return (
    <View style={[styles.actions, {gap: spacing[2]}]}>
      {!installed ? (
        <ModulaButton
          label={presentation.primaryAction === 'Can’t install on this device' ? 'Can’t install on this device' : presentation.primaryAction}
          accessibilityLabel={`${presentation.primaryAction} module`}
          disabled={!presentation.installable}
          loading={busy === 'review'}
          onPress={onPreview}
        />
      ) : null}
      {state === 'disabled' || state === 'installed' ? <ModulaButton label="Enable" accessibilityLabel="Enable module" loading={busy === 'enable'} onPress={onEnable} /> : null}
      {state === 'enabled' || state === 'configurationRequired' ? <ModulaButton label="Open" accessibilityLabel="Open module" onPress={onOpen} /> : null}
      {state === 'enabled' ? <ModulaButton label="Disable" role="secondary" accessibilityLabel="Disable module" loading={busy === 'disable'} onPress={onDisable} /> : null}
      {state === 'updateAvailable' ? <ModulaButton label="Update" accessibilityLabel="Update module" loading={busy === 'update'} onPress={onUpdate} /> : null}
      {installed ? <ModulaButton label="Configure" role="secondary" accessibilityLabel="Open module settings" onPress={onSettings} /> : null}
      {installed ? <ModulaButton label="Uninstall" role="destructive" accessibilityLabel="Uninstall module" loading={busy === 'uninstall'} onPress={onUninstall} /> : null}
    </View>
  )
}

function Section({title, children}: {title: string; children: ReactNode}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Surface
      variant="contained"
      style={[
        styles.section,
        {
          backgroundColor: colours.surface,
          borderColor: colours.border,
          borderRadius: radius.large,
          gap: spacing[3],
          padding: spacing[4],
        },
      ]}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </Surface>
  )
}

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.infoRow}>
      <AppText variant="caption" colour="textTertiary">{label}</AppText>
      <AppText variant="caption" colour="textSecondary" selectable>{value}</AppText>
    </View>
  )
}

function PermissionGroup({title, permissions}: {title: string; permissions: string[]}) {
  return (
    <View style={{gap: 4}}>
      <AppText variant="label">{title}</AppText>
      <AppText variant="caption" colour="textSecondary">{permissions.length ? permissions.join(', ') : 'None declared'}</AppText>
    </View>
  )
}

function platformPermissions(module: ModuleDetail): string[] {
  const backend = new Set(module.backend.backendPermissions)
  return module.permissions
    .map(permission => permission.permission)
    .filter(permission => !backend.has(permission) && !isExternalPermission(permission))
}

function backendPermissions(module: ModuleDetail): string[] {
  return module.backend.backendPermissions
}

function externalPermissions(module: ModuleDetail): string[] {
  return module.permissions.map(permission => permission.permission).filter(isExternalPermission)
}

function isExternalPermission(permission: string): boolean {
  return permission.startsWith('network:') || permission.startsWith('connector:') || permission.startsWith('dimon:')
}

function backendModeLabel(mode: string): string {
  if (mode === 'greenfield-managed') return 'Greenfield-managed'
  if (mode === 'module-managed') return 'Module-managed'
  if (mode === 'frontend-only') return 'Frontend-only'
  return 'Hybrid'
}

function ownershipLabel(value: string): string {
  return value.replace(/-/g, ' ').replace(/^./, char => char.toUpperCase())
}

function dataLocationLabel(value: string): string {
  if (value === 'greenfield') return 'Greenfield'
  if (value === 'module-backend') return 'Module provider'
  if (value === 'device') return 'Device'
  return 'Mixed'
}

function statusLabel(value: string): string {
  return value.replace(/-/g, ' ').replace(/^./, char => char.toUpperCase())
}

function summariseObject(value: Record<string, unknown>): string {
  const entries = Object.entries(value ?? {})
  if (!entries.length) return 'No contributions are declared for this release.'
  return entries.map(([key, item]) => `${key}: ${Array.isArray(item) ? item.length : 1}`).join(' · ')
}

function standardDependencySummary(module: ModuleDetail): string {
  const dependencies = module.standard?.dependencies
  if (!dependencies) return 'Not declared'
  return [
    `requires ${dependencies.requires}`,
    `optional ${dependencies.optional}`,
    `recommended ${dependencies.recommended}`,
    `conflicts ${dependencies.conflicts}`,
    `provides ${dependencies.provides}`,
  ].join(' · ')
}

function standardRegistrySummary(module: ModuleDetail): string {
  const registries = module.standard?.registries
  if (!registries) return 'Not declared'
  return [
    `services ${registries.services}`,
    `APIs ${registries.apis}`,
    `hooks ${registries.hooks}`,
    `jobs ${registries.jobs}`,
    `widgets ${registries.widgets}`,
    `automation ${registries.automation}`,
  ].join(' · ')
}

function standardCapabilitySummary(module: ModuleDetail): string {
  const flags = module.standard?.capabilityFlags ?? {}
  const enabled = Object.entries(flags)
    .filter(([, value]) => value)
    .map(([key]) => key.replace(/^supports/, ''))
  const declared = [...(module.standard?.capabilities ?? []), ...enabled]
  return declared.length ? declared.slice(0, 10).join(', ') : 'Not declared'
}

function runtimeSupportCount(module: ModuleDetail, state: string): string {
  const sections = Object.values(module.standard?.runtimeSupport?.sections ?? {})
  return String(sections.filter(sectionState => sectionState === state).length)
}

function runtimeDiagnosticSummary(module: ModuleDetail): string {
  const diagnostics = module.standard?.runtimeDiagnostics ?? []
  if (!diagnostics.length) return 'None declared'
  return diagnostics
    .slice(0, 8)
    .map(diagnostic => `${diagnostic.section}: ${runtimeStateLabel(diagnostic.state)}`)
    .join(' · ')
}

function runtimeStateLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ')
}

function hasRegistryMetadata(module: ModuleDetail): boolean {
  const registries = module.standard?.registries
  if (!registries) return false
  return registries.services + registries.apis + registries.hooks + registryItemCount(module.eventBus) > 0
}

function registryPreview(value: Record<string, unknown> | undefined, field: string): string {
  const items = registryItems(value)
  if (!items.length) return 'Not declared'
  return items
    .slice(0, 6)
    .map(item => String(item[field] ?? item.title ?? item.id ?? 'registry item'))
    .join(', ')
}

function apiRegistryPreview(value: Record<string, unknown> | undefined): string {
  const items = registryItems(value)
  if (!items.length) return 'Not declared'
  return items
    .slice(0, 6)
    .map(item => `${String(item.method ?? 'API')} ${String(item.path ?? item.id ?? '')}`)
    .join(', ')
}

function registryItemCount(value: Record<string, unknown> | undefined): number {
  return registryItems(value).length
}

function registryItems(value: Record<string, unknown> | undefined): Record<string, unknown>[] {
  const items = value?.items
  return Array.isArray(items) ? items.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)) : []
}

const styles = StyleSheet.create({
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  content: {padding: 16, paddingBottom: 40},
  flex: {flex: 1, minWidth: 0},
  hero: {borderWidth: StyleSheet.hairlineWidth},
  heroHeader: {alignItems: 'center', flexDirection: 'row', gap: 16},
  icon: {alignItems: 'center', height: 72, justifyContent: 'center', width: 72},
  infoRow: {gap: 2},
  screen: {flex: 1},
  section: {borderWidth: StyleSheet.hairlineWidth},
  wrap: {flexDirection: 'row', flexWrap: 'wrap'},
})
