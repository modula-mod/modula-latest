import type {ReactNode} from 'react'
import {useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {InstallPreviewSheet, ModuleStatusPill} from '@/features/modules/components'
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

  const openPreview = async () => {
    if (!module) return
    setBusy('review')
    try {
      setPreview(await services.moduleRepository.installPreview(module.moduleId, module.latestVersion ?? undefined))
      setInstallSheetOpen(true)
    } finally {
      setBusy(null)
    }
  }

  const install = async (enable: boolean) => {
    if (!module) return
    setBusy(enable ? 'install-enable' : 'install')
    try {
      await services.moduleRepository.install(module.moduleId, {version: module.latestVersion ?? undefined})
      if (enable) await services.moduleRepository.enable(module.moduleId)
      setInstallSheetOpen(false)
      await detail.refetch()
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
              <View style={[styles.icon, {backgroundColor: colours.accentSubtle, borderRadius: radius.large}]}>
                <AppIcon name={module.kind === 'system' ? 'security' : 'modules'} colour={colours.accent} size={32} />
              </View>
              <View style={styles.flex}>
                <AppText variant="display">{module.name}</AppText>
                <AppText variant="body" colour="textSecondary">{module.publisherName}</AppText>
              </View>
            </View>
            <AppText variant="body" colour="textSecondary">{module.longDescription || module.description}</AppText>
            <View style={[styles.wrap, {gap: spacing[2]}]}>
              <ModuleStatusPill state={module.installationState} />
              <ModuleStatusPill state={module.priceState} />
              <ModuleStatusPill state={module.trustLevel} />
            </View>
            <ActionRow
              state={module.installationState}
              busy={busy}
              installable={module.installable}
              onPreview={openPreview}
              onOpen={() => router.push(`/module/${encodeURIComponent(module.moduleId)}` as Href)}
              onSettings={() => router.push(`/settings/modules/${encodeURIComponent(module.moduleId)}` as Href)}
              onEnable={() => void transition('enable')}
              onDisable={() => void transition('disable')}
              onUpdate={() => void transition('update')}
              onUninstall={() => void transition('uninstall')}
            />
          </Surface>

          <Section title="What this module does">
            <AppText variant="body" colour="textSecondary">{module.description}</AppText>
          </Section>
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
          <Section title="Permissions">
            <PermissionGroup title="Platform permissions" permissions={platformPermissions(module)} />
            <PermissionGroup title="Module backend permissions" permissions={backendPermissions(module)} />
            <PermissionGroup title="External service permissions" permissions={externalPermissions(module)} />
          </Section>
          <Section title="All declared permissions">
            {module.permissions.length ? (
              module.permissions.map(permission => (
                <View key={permission.permission} style={{gap: spacing[1]}}>
                  <AppText variant="label">{permission.permission}</AppText>
                  <AppText variant="caption" colour="textSecondary">{permission.reason}</AppText>
                  <ModuleStatusPill state={permission.risk} />
                </View>
              ))
            ) : (
              <AppText variant="caption" colour="textSecondary">No permissions declared for the selected release state.</AppText>
            )}
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
          <Section title="Release notes">
            {(module.releaseNotes ?? []).length ? (
              module.releaseNotes?.map(note => (
                <AppText key={note} variant="caption" colour="textSecondary">{note}</AppText>
              ))
            ) : (
              <AppText variant="caption" colour="textSecondary">No release notes are published for this registry item.</AppText>
            )}
          </Section>
          <Section title="Privacy">
            <AppText variant="caption" colour="textSecondary">{module.privacy ?? 'Privacy metadata is declared by the module release and enforced by registered permissions.'}</AppText>
          </Section>
          <Section title="Related extensions">
            <AppText variant="caption" colour="textSecondary">Plugins, tools, functions, widgets and connectors appear in Product Hub when declared by the registry.</AppText>
          </Section>
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
  installable,
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
  installable: boolean
  onPreview: () => void
  onOpen: () => void
  onSettings: () => void
  onEnable: () => void
  onDisable: () => void
  onUpdate: () => void
  onUninstall: () => void
}) {
  const {spacing} = useThemeTokens()
  const installed = ['installed', 'enabled', 'disabled', 'updateAvailable', 'configurationRequired'].includes(state)
  return (
    <View style={[styles.actions, {gap: spacing[2]}]}>
      {!installed ? (
        <ModulaButton label={installable ? 'Install' : 'Not available'} accessibilityLabel="Install module" disabled={!installable} loading={busy === 'review'} onPress={onPreview} />
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
