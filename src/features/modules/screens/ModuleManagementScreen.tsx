import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {SchemaSettingsRenderer, ModuleStatusPill} from '@/features/modules/components'
import {useInstalledModulesQuery, useModuleBackendDiagnosticsQuery, useModuleContributionQuery, useModuleDetailQuery, useModuleHealthQuery} from '@/features/modules/hooks'
import {
  SettingsLinkRow,
  SettingsScreen,
  SettingsSection,
  SettingsToggleRow,
} from '@/features/settings/components/SettingsRows'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleManagementScreen({moduleId}: {moduleId: unknown}) {
  const id = typeof moduleId === 'string' ? moduleId : ''
  const router = useRouter()
  const services = useAppServices()
  const detail = useModuleDetailQuery(id)
  const health = useModuleHealthQuery(id)
  const backendDiagnostics = useModuleBackendDiagnosticsQuery(id)
  const contributions = useModuleContributionQuery({moduleId: id})
  const installedModules = useInstalledModulesQuery()
  const {colours, radius, spacing} = useThemeTokens()
  const [automaticUpdates, setAutomaticUpdates] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [uninstallPreview, setUninstallPreview] = useState<string | null>(null)
  const module = detail.data
  const backend = backendDiagnostics.data ?? module?.backend ?? null
  const installed = installedModules.data?.find(item => item.moduleId === id)
  const grantedPermissions = installed?.grantedPermissions ?? []
  const grantedAiPermissions = grantedPermissions.filter(permission => permission.startsWith('ai.'))

  const transition = async (kind: 'enable' | 'disable' | 'update' | 'uninstall' | 'preview-uninstall') => {
    if (!module) return
    if (kind === 'disable') {
      const confirmed = await confirmModulaAction({
        title: 'Disable module',
        message: 'Registered contributions stop running. Settings and retained data are kept.',
        confirmLabel: 'Disable module',
        cancelLabel: 'Cancel',
      })
      if (!confirmed) return
    }
    if (kind === 'uninstall') {
      const confirmed = await confirmModulaAction({
        title: 'Uninstall module',
        message: `Type-name deletion is required only for Delete data. This action keeps ${module.name} data by default.`,
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
      if (kind === 'preview-uninstall') {
        const preview = await services.moduleRepository.uninstallPreview(module.moduleId)
        setUninstallPreview(`${preview.recordCount} records · ${preview.registeredContributions.length} contributions · default: keep data`)
      }
      await detail.refetch()
    } finally {
      setBusy(null)
    }
  }

  const backendAction = async (kind: 'reverify' | 'health' | 'disable') => {
    if (!module) return
    if (kind === 'disable') {
      const confirmed = await confirmModulaAction({
        title: 'Disable backend connection',
        message: 'Module metadata and installation state remain intact. Backend actions, events and webhooks are blocked until the connection is reverified.',
        confirmLabel: 'Disable backend',
        cancelLabel: 'Cancel',
      })
      if (!confirmed) return
    }
    setBusy(`backend-${kind}`)
    try {
      if (kind === 'reverify') await services.moduleRepository.reverifyBackend(module.moduleId)
      if (kind === 'health') await services.moduleRepository.checkBackendHealth(module.moduleId)
      if (kind === 'disable') await services.moduleRepository.disableBackend(module.moduleId)
      await Promise.all([backendDiagnostics.refetch(), health.refetch()])
    } finally {
      setBusy(null)
    }
  }

  const revokeAI = async () => {
    if (!module) return
    const confirmed = await confirmModulaAction({
      title: 'Revoke AI access',
      message: 'Vault Notes remains enabled. AI actions stop until the AI permissions are granted again.',
      confirmLabel: 'Revoke AI access',
      cancelLabel: 'Cancel',
    })
    if (!confirmed) return
    setBusy('ai-revoke')
    try {
      await services.moduleRepository.reviewPermissions(
        module.moduleId,
        (installed?.grantedPermissions ?? module.permissions.map(permission => permission.permission))
          .filter(permission => !permission.startsWith('ai.')),
      )
      await Promise.all([detail.refetch(), installedModules.refetch()])
    } finally {
      setBusy(null)
    }
  }

  return (
    <SettingsScreen
      title={module?.name ?? 'Module'}
      caption="Manage installed module state without bypassing permission-increase review. Destructive data deletion remains gated.">
      {!module ? (
        <SettingsSection title="Status">
          <View style={{padding: spacing[4]}}>
            <AppText variant="caption" colour="textSecondary">Module metadata is unavailable for this account.</AppText>
          </View>
        </SettingsSection>
      ) : (
        <>
          <SettingsSection title="Status">
            <View style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
              <View style={[styles.wrap, {gap: spacing[2]}]}>
                <ModuleStatusPill state={module.installationState} />
                <ModuleStatusPill state={module.trustLevel} />
                <ModuleStatusPill state={module.priceState} />
              </View>
              <AppText variant="caption" colour="textSecondary">
                Health is isolated to this module host. Failed contributions render as unavailable cards instead of breaking Modula.
              </AppText>
              <View style={[styles.actions, {gap: spacing[2]}]}>
                {module.installationState === 'enabled' ? (
                  <ModulaButton label="Disable" accessibilityLabel="Disable module" role="secondary" loading={busy === 'disable'} onPress={() => void transition('disable')} />
                ) : (
                  <ModulaButton label="Enable" accessibilityLabel="Enable module" loading={busy === 'enable'} onPress={() => void transition('enable')} />
                )}
                <ModulaButton label="Open module" accessibilityLabel="Open module" role="secondary" onPress={() => router.push(`/module/${encodeURIComponent(module.moduleId)}` as Href)} />
              </View>
            </View>
          </SettingsSection>

          <SettingsSection title="Diagnostics">
            <View style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
              <View style={[styles.wrap, {gap: spacing[2]}]}>
                <ModuleStatusPill state={health.data?.overall ?? 'unknown'} />
                <ModuleStatusPill state={String(health.data?.runtime?.installationStatus ?? module.installationState)} />
                <ModuleStatusPill state={String((health.data?.searchProjection as any)?.status ?? 'search')} />
              </View>
              {health.data?.diagnostics ? (
                <View style={{gap: spacing[1]}}>
                  <AppText variant="caption" colour="textSecondary">{formatDiagnosticCounts(health.data.diagnostics.recordCounts, 'records')}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Versions {String(health.data.diagnostics.versionCount ?? 0)} · failed actions {String(health.data.diagnostics.failedActions ?? 0)} · export failures {String(health.data.diagnostics.exportFailures ?? 0)}
                  </AppText>
                </View>
              ) : (
                <AppText variant="caption" colour="textSecondary">Diagnostics are unavailable for this module.</AppText>
              )}
            </View>
          </SettingsSection>

          <SettingsSection title="Backend">
            <View style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
              {backend ? (
                <>
                  <View style={[styles.wrap, {gap: spacing[2]}]}>
                    <ModuleStatusPill state={backend.mode} />
                    <ModuleStatusPill state={backend.status} />
                    <ModuleStatusPill state={backend.dataLocation} />
                  </View>
                  <InfoLine label="Provider" value={backend.provider} />
                  <InfoLine label="Deployment" value={formatLabel(backend.deploymentOwnership)} />
                  <InfoLine label="Endpoint" value={backend.endpoint ?? 'Resolved during installation'} />
                  <InfoLine label="Protocol" value={backend.protocolVersion ?? 'Not required'} />
                  <InfoLine label="Data location" value={formatLabel(backend.dataLocation)} />
                  <InfoLine label="Regions" value={backend.regions.length ? backend.regions.join(', ') : 'Not declared'} />
                  <InfoLine label="Self-hosting" value={backend.selfHostingSupported ? 'Supported' : 'Not supported'} />
                  <InfoLine label="External data processing" value={backend.externalDataProcessing ? 'Yes' : 'No'} />
                  <View style={[styles.actions, {gap: spacing[2]}]}>
                    <ModulaButton label="Reverify" role="secondary" accessibilityLabel="Reverify module backend" loading={busy === 'backend-reverify'} onPress={() => void backendAction('reverify')} />
                    <ModulaButton label="Health check" role="secondary" accessibilityLabel="Check module backend health" loading={busy === 'backend-health'} onPress={() => void backendAction('health')} />
                    <ModulaButton label="Disable backend" role="secondary" accessibilityLabel="Disable module backend" loading={busy === 'backend-disable'} onPress={() => void backendAction('disable')} />
                  </View>
                </>
              ) : (
                <AppText variant="caption" colour="textSecondary">Backend diagnostics are unavailable for this module.</AppText>
              )}
            </View>
          </SettingsSection>

          <SettingsSection title="AI">
            <View style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
              {module.ai?.productActions.length ? (
                <>
                  <View style={[styles.wrap, {gap: spacing[2]}]}>
                    <ModuleStatusPill state={grantedAiPermissions.length ? 'AI enabled' : 'AI permission required'} />
                    <ModuleStatusPill state={backend?.status ?? 'provider configured in Greenfield'} />
                    <ModuleStatusPill state="optional capability" />
                  </View>
                  <InfoLine label="Permitted actions" value={module.ai.productActions.map(action => action.name).join(', ')} />
                  <InfoLine label="Granted AI permissions" value={grantedAiPermissions.length ? grantedAiPermissions.join(', ') : 'No AI grants'} />
                  <InfoLine label="Data sent to provider" value="Authorised note context, selected content, non-sensitive metadata and action variables only" />
                  <InfoLine label="Provider retention" value="Controlled by Greenfield AI provider configuration" />
                  <InfoLine label="Usage" value="Execution metadata, latency, provider/model and token estimates are retained; note text is not written to audit records" />
                  <View style={[styles.actions, {gap: spacing[2]}]}>
                    <ModulaButton
                      label="Revoke AI access"
                      accessibilityLabel="Revoke module AI access"
                      role="secondary"
                      disabled={!grantedAiPermissions.length}
                      loading={busy === 'ai-revoke'}
                      onPress={() => void revokeAI()}
                    />
                  </View>
                </>
              ) : (
                <AppText variant="caption" colour="textSecondary">This module does not declare AI product actions.</AppText>
              )}
            </View>
          </SettingsSection>

          <SettingsSection title="Version">
            <SettingsLinkRow
              row={{
                title: module.latestVersion ? `Version ${module.latestVersion}` : 'Version unavailable',
                description: module.compatibility,
                icon: 'info',
                value: module.installationState === 'updateAvailable' ? 'Update' : 'Current',
                onPress: () => void transition('update'),
              }}
              last
            />
          </SettingsSection>

          <SettingsSection title="Updates">
            <SettingsToggleRow
              label="Automatic updates"
              description="Permission increases still require review before activation."
              value={automaticUpdates}
              onValueChange={setAutomaticUpdates}
            />
            <View style={[styles.panel, {padding: spacing[4]}]}>
              <ModulaButton label="Check for update" accessibilityLabel="Update module" role="secondary" loading={busy === 'update'} onPress={() => void transition('update')} />
            </View>
          </SettingsSection>

          <SettingsSection title="Permissions">
            <View style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
              {module.permissions.length ? (
                module.permissions.map(permission => (
                  <View key={permission.permission} style={{gap: spacing[1]}}>
                    <AppText variant="label">{permission.permission}</AppText>
                    <AppText variant="caption" colour="textSecondary">{permission.reason}</AppText>
                    <ModuleStatusPill state={permission.risk} />
                  </View>
                ))
              ) : (
                <AppText variant="caption" colour="textSecondary">No granted permissions are declared for this module.</AppText>
              )}
            </View>
          </SettingsSection>

          <SettingsSection title="Module settings">
            <View style={[styles.panel, {padding: spacing[4]}]}>
              <SchemaSettingsRenderer moduleId={module.moduleId} />
            </View>
          </SettingsSection>

          <SettingsSection title="Contributions">
            <View style={[styles.panel, {gap: spacing[2], padding: spacing[4]}]}>
              {(contributions.data ?? []).length ? (
                contributions.data?.map(contribution => (
                  <View key={contribution.id} style={[styles.contribution, {borderColor: colours.border, borderRadius: radius.medium, padding: spacing[3]}]}>
                    <AppText variant="label">{contribution.type}</AppText>
                    <AppText variant="caption" colour="textSecondary">{contribution.id} · {contribution.available ? 'Available' : contribution.disabledReason ?? 'Unavailable'}</AppText>
                  </View>
                ))
              ) : (
                <AppText variant="caption" colour="textSecondary">No registered contributions are visible for this account.</AppText>
              )}
            </View>
          </SettingsSection>

          <SettingsSection title="Data">
            <SettingsLinkRow
              row={{
                title: 'Export module data',
                description: 'Prepare account-scoped records for this module.',
                icon: 'storage',
                value: 'Available later',
              }}
            />
            <SettingsLinkRow
              last
              row={{
                title: 'Clear module cache',
                description: 'Clears local host cache only, not module records.',
                icon: 'reset',
                value: 'Local',
              }}
            />
          </SettingsSection>

          <SettingsSection title="Troubleshooting">
            <View style={[styles.panel, {padding: spacing[4], gap: spacing[2]}]}>
              <AppText variant="caption" colour="textSecondary">
                Safe developer details can show failed hook IDs and error codes. Stack traces and worker payloads are not exposed here.
              </AppText>
              <ModulaButton label="Open module settings" accessibilityLabel="Open module settings" role="secondary" onPress={() => undefined} />
            </View>
          </SettingsSection>

          <SettingsSection title="Danger zone">
            <View style={[styles.panel, {padding: spacing[4], gap: spacing[3]}]}>
              <AppText variant="caption" colour="textSecondary">
                Uninstall defaults to Keep data. Delete-data uninstall requires recent authentication and a second explicit confirmation.
              </AppText>
              {uninstallPreview ? <AppText variant="caption" colour="textSecondary">{uninstallPreview}</AppText> : null}
              <View style={[styles.actions, {gap: spacing[2]}]}>
                <ModulaButton label="Preview uninstall" role="secondary" accessibilityLabel="Uninstall module" loading={busy === 'preview-uninstall'} onPress={() => void transition('preview-uninstall')} />
                <ModulaButton label="Uninstall" role="destructive" accessibilityLabel="Uninstall module" loading={busy === 'uninstall'} onPress={() => void transition('uninstall')} />
              </View>
            </View>
          </SettingsSection>
        </>
      )}
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  contribution: {borderWidth: StyleSheet.hairlineWidth},
  panel: {},
  wrap: {flexDirection: 'row', flexWrap: 'wrap'},
})

function formatDiagnosticCounts(value: unknown, suffix: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return `0 ${suffix}`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, count]) => Number(count) > 0)
    .slice(0, 4)
    .map(([collection, count]) => `${collection}: ${String(count)}`)
  return entries.length ? entries.join(' · ') : `0 ${suffix}`
}

function formatLabel(value: string) {
  return value.replace(/-/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
}

function InfoLine({label, value}: {label: string; value: string}) {
  return (
    <View style={{gap: 2}}>
      <AppText variant="caption" colour="textSecondary">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}
