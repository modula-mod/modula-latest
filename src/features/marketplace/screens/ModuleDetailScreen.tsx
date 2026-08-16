import {useState} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import {useQueryClient} from '@tanstack/react-query'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {EmptyState} from '@/components/primitives/EmptyState'
import {InstallPreviewSheet, ModuleInstallProgress} from '@/features/modules/components'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import {ModulePreview} from '@/features/modules/components/presentation/ModulePreview'
import type {ModuleInstallStageId} from '@/features/modules/components/ModuleInstallProgress'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useModuleDetailQuery} from '@/features/modules/hooks'
import {moduleQueryKeys} from '@/features/modules/state/moduleQueryKeys'
import type {ModuleDetail, ModuleInstallPreview, ModuleInstallationState} from '@/data/repositories/contracts'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {LAYERS} from '@/theme/tokens/layers'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleDetailScreen() {
  const {moduleId} = useLocalSearchParams<{moduleId: string}>()
  const id = String(moduleId ?? '')
  const router = useRouter()
  const services = useAppServices()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const detail = useModuleDetailQuery(id)
  const module = detail.data
  const [preview, setPreview] = useState<ModuleInstallPreview | null>(null)
  const [installSheetOpen, setInstallSheetOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [installStage, setInstallStage] = useState<ModuleInstallStageId | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [heroActionVisible, setHeroActionVisible] = useState(true)

  const refreshCatalogue = async () => {
    await Promise.all([
      detail.refetch(),
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.catalogueRoot}),
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.installed}),
    ])
  }

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
      await refreshCatalogue()
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
      await refreshCatalogue()
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
        <EmptyState icon="modules" title="Loading module" description="Resolving this product." />
      </View>
    )
  }

  if (!module) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <EmptyState
          icon="marketplace"
          title="Module unavailable"
          description="This product is not available for the current account."
          action={<ModulaButton label="Return to Product Hub" role="secondary" onPress={() => router.push('/product' as Href)} />}
        />
      </View>
    )
  }

  const copy = productCopyFor(module.moduleId, module.name, module.longDescription || module.description)
  const presentation = resolveModuleInstallPresentation(module)
  const openModule = () => router.push(`/module/${encodeURIComponent(module.moduleId)}` as Href)
  const showSticky = !heroActionVisible
  const releaseNotes = module.releaseNotes?.filter(Boolean) ?? []

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <View
        style={[
          styles.chrome,
          {
            paddingTop: insets.top + 8,
            paddingHorizontal: spacing[3],
            backgroundColor: colours.canvas,
            zIndex: LAYERS.sticky,
          },
        ]}>
        <View style={styles.chromeRow}>
          <ChromeCircleButton
            icon="back"
            accessibilityLabel="Go back"
            onPress={() => {
              if (router.canGoBack()) router.back()
              else router.replace('/product' as Href)
            }}
          />
          {showSticky ? (
            <View style={styles.stickyIdentity} testID="module-sticky-install">
              <ModuleArtwork moduleId={module.moduleId} name={copy.name} size={28} />
              <AppText variant="label" numberOfLines={1} style={styles.flex}>
                {copy.name}
              </AppText>
              <ModuleAction
                presentation={presentation}
                productName={copy.name}
                loading={busy === 'review'}
                onPress={presentation.primaryAction === 'Open' ? openModule : openPreview}
              />
            </View>
          ) : (
            <View style={styles.flex} />
          )}
        </View>
      </View>

      <ResponsiveContent maxWidth={780}>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[6], paddingBottom: tabPadding + spacing[6]}]}
          keyboardShouldPersistTaps="handled"
          onScroll={event => {
            setHeroActionVisible(event.nativeEvent.contentOffset.y < 164)
          }}
          scrollEventThrottle={16}>
          <View style={[styles.hero, {gap: spacing[4]}]}>
            <ModuleArtwork moduleId={module.moduleId} name={copy.name} size={88} variant="hero" />
            <View style={{gap: spacing[1]}}>
              <AppText variant="display">{copy.name}</AppText>
              <AppText variant="body" colour="textSecondary">{copy.short}</AppText>
              <AppText variant="caption" colour="textTertiary">
                {copy.publisher}
                {module.trustLevel === 'firstParty' ? '  ·  Modula' : ''}
              </AppText>
            </View>
            <View
              onLayout={() => undefined}
              testID="module-hero-install">
              {installStage && installStage !== 'ready' ? (
                <ModuleInstallProgress
                  productName={copy.name}
                  stage={installStage}
                  failed={installError}
                  onOpen={openModule}
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
                  onOpen={openModule}
                  onSettings={() => router.push(`/settings/modules/${encodeURIComponent(module.moduleId)}` as Href)}
                  onEnable={() => void transition('enable')}
                  onDisable={() => void transition('disable')}
                  onUpdate={() => void transition('update')}
                  onUninstall={() => void transition('uninstall')}
                />
              )}
            </View>
            <View style={styles.metaRow}>
              <MetaChip label="Private data" />
              <MetaChip label={`Version ${module.latestVersion ?? 'unreleased'}`} />
              {module.standard?.standardVersion ? <MetaChip label="Module Standard" /> : null}
            </View>
          </View>

          <View style={[styles.rule, {backgroundColor: colours.separator}]} />

          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">What {copy.name} does</AppText>
            <AppText variant="body" colour="textSecondary">{copy.whatItDoes}</AppText>
          </View>

          <ModulePreview moduleId={module.moduleId} name={copy.name} />

          <Disclosure
            title="What's New"
            summary={`Version ${module.latestVersion ?? 'unreleased'}`}
            body={releaseNotes.length ? releaseNotes.join('\n') : 'Folders, search and lifecycle improvements.'}
          />

          <Disclosure
            title="Privacy & Access"
            summary={copy.privacy}
            open={privacyOpen}
            onToggle={() => setPrivacyOpen(open => !open)}
            body="Records stay account-scoped. Other accounts cannot read them."
          />

          <AppPressable
            accessibilityLabel="Made by Modula"
            onPress={() => router.push('/product' as Href)}>
            <AppText variant="headline">{`Made by ${copy.publisher} >`}</AppText>
          </AppPressable>

          <AppPressable
            accessibilityLabel="Trust and technical details"
            onPress={() => setTechnicalOpen(open => !open)}>
            <AppText variant="headline">{`Trust & Technical Details ${technicalOpen ? '⌃' : '>'}`}</AppText>
          </AppPressable>
          {technicalOpen ? <TechnicalDetails module={module} /> : null}
        </ScrollView>
      </ResponsiveContent>

      <InstallPreviewSheet
        module={module}
        preview={preview}
        isPresented={installSheetOpen}
        pending={Boolean(busy)}
        stage={installStage}
        failed={installError}
        onDismiss={() => setInstallSheetOpen(false)}
        onInstall={() => void install(false)}
        onInstallAndEnable={() => void install(true)}
        onOpen={openModule}
      />
    </View>
  )
}

function MetaChip({label}: {label: string}) {
  return (
    <AppText variant="micro" colour="textTertiary" style={{marginRight: 12}}>
      {label}
    </AppText>
  )
}

function Disclosure({
  title,
  summary,
  body,
  open,
  onToggle,
}: {
  title: string
  summary: string
  body?: string
  open?: boolean
  onToggle?: () => void
}) {
  const {colours, spacing} = useThemeTokens()
  const [localOpen, setLocalOpen] = useState(false)
  const shown = open ?? localOpen
  return (
    <View style={{gap: spacing[2]}}>
      <AppPressable
        accessibilityLabel={`${title}. ${shown ? 'Hide' : 'Show'} details`}
        onPress={onToggle ?? (() => setLocalOpen(value => !value))}>
        <AppText variant="headline">{`${title} ${shown ? '⌃' : '>'}`}</AppText>
      </AppPressable>
      <AppText variant="caption" colour="textSecondary">{summary}</AppText>
      {shown && body ? <AppText variant="body" colour="textSecondary">{body}</AppText> : null}
      <View style={[styles.rule, {backgroundColor: colours.separator}]} />
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
        <ModuleAction
          presentation={presentation}
          productName="module"
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

function TechnicalDetails({module}: {module: ModuleDetail}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[4]}}>
      <InfoRow label="Publisher" value={module.publisherName} />
      <InfoRow label="Source" value={module.sourceRepository || 'Not declared'} />
      <InfoRow label="Version" value={module.latestVersion ?? 'Unreleased'} />
      <InfoRow label="Manifest" value={module.standard?.manifestVersion ? `v${module.standard.manifestVersion}` : 'Not declared'} />
      <InfoRow label="Module Standard" value={module.standard?.standardVersion ?? 'Legacy'} />
      <InfoRow label="Repository" value={module.sourceRepository || 'Not declared'} />
      <InfoRow label="Commit" value={module.sourceCommit || 'Not declared'} />
      <InfoRow label="Checksum" value={module.manifestChecksum || 'Pending'} />
      <InfoRow label="Permissions" value={module.permissions.map(item => item.permission).join(', ') || 'None declared'} />
      <InfoRow label="Mode" value={backendModeLabel(module.backend.mode)} />
      <InfoRow label="Compatibility" value={module.compatibility} />
    </View>
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

function backendModeLabel(mode: string): string {
  if (mode === 'greenfield-managed') return 'Managed by Modula'
  if (mode === 'module-managed') return 'Module-managed'
  if (mode === 'frontend-only') return 'Frontend-only'
  return 'Hybrid'
}

const styles = StyleSheet.create({
  actions: {alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap'},
  chrome: {width: '100%'},
  chromeRow: {alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 44},
  content: {padding: 16},
  flex: {flex: 1, minWidth: 0},
  hero: {alignItems: 'flex-start'},
  infoRow: {gap: 2},
  metaRow: {flexDirection: 'row', flexWrap: 'wrap'},
  rule: {height: StyleSheet.hairlineWidth, width: '100%'},
  screen: {flex: 1},
  stickyIdentity: {alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0},
})
