import {useEffect, useState} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import {useQueryClient} from '@tanstack/react-query'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {EmptyState} from '@/components/primitives/EmptyState'
import {InstallPreviewSheet, ModuleInstallProgress} from '@/features/modules/components'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import {ModulePreview} from '@/features/modules/components/presentation/ModulePreview'
import type {ModuleInstallStageId} from '@/features/modules/components/ModuleInstallProgress'
import {resolveModuleInstallPresentation, isInstalledModuleState} from '@/features/modules/identity/installPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useModuleDetailQuery} from '@/features/modules/hooks'
import {moduleQueryKeys} from '@/features/modules/state/moduleQueryKeys'
import type {ModuleDetail, ModuleInstallPreview, ModuleInstallationState} from '@/data/repositories/contracts'
import {ProductStatsRow} from '@/platform/ui/chrome/product-stats-row'
import {SectionHeader} from '@/platform/ui/chrome/section-header'
import {type ModulaIconName} from '@/platform/ui/icons'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {shareModulaText} from '@/platform/ui/share/share-modula-text'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {LAYERS} from '@/theme/tokens/layers'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleDetailScreen() {
  const {moduleId, install} = useLocalSearchParams<{moduleId: string; install?: string}>()
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
  const [installSheetOpen, setInstallSheetOpen] = useState(
    () => install === '1' || install === 'true',
  )
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

  const openPreview = () => {
    setInstallSheetOpen(true)
  }

  useEffect(() => {
    if (!installSheetOpen || !module || preview) return
    let cancelled = false
    void services.moduleRepository
      .installPreview(module.moduleId, module.latestVersion ?? undefined)
      .then(next => {
        if (!cancelled) setPreview(next)
      })
      .catch(error => {
        if (cancelled) return
        Alert.alert(
          'Install preview unavailable',
          error instanceof Error ? error.message : 'Could not load install preview for this module.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [installSheetOpen, module, preview, services.moduleRepository])

  const installModule = async (enable: boolean) => {
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
  const installed = isInstalledModuleState(module.installationState)
  const openModule = () => router.push(`/module/${encodeURIComponent(module.moduleId)}` as Href)
  const showSticky = !heroActionVisible
  const releaseNotes = module.releaseNotes?.filter(Boolean) ?? []
  const shareModule = () =>
    void shareModulaText({
      title: copy.name,
      message: `${copy.name} — ${copy.short}`,
    })
  const overflowActions: ModulaActionItem[] = [
    {id: 'share', label: 'Share', icon: 'share'},
    {id: 'hub', label: 'Product Hub', icon: 'modules'},
    ...(module.installationState === 'disabled' || module.installationState === 'installed'
      ? [{id: 'enable', label: 'Enable', icon: 'check' as const}]
      : []),
    ...(module.installationState === 'enabled'
      ? [{id: 'disable', label: 'Disable', icon: 'privacy' as const}]
      : []),
    ...(module.installationState === 'updateAvailable'
      ? [{id: 'update', label: 'Update', icon: 'update' as const}]
      : []),
    {id: 'settings', label: installed ? 'Configure' : 'Module settings', icon: 'settings'},
    ...(installed
      ? [{id: 'uninstall', label: 'Uninstall', icon: 'trash' as const, style: 'destructive' as const}]
      : []),
  ]
  const installLabel =
    module.installationState === 'available'
      ? 'Available'
      : module.installationState === 'enabled'
        ? 'Open'
        : module.installationState === 'installed'
          ? 'Installed'
          : module.installationState === 'updateAvailable'
            ? 'Update'
            : 'Preview'

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
          <ModulaBackButton
            onPress={() => {
              if (router.canGoBack()) router.back()
              else router.replace('/product' as Href)
            }}
          />
          <View
            pointerEvents={showSticky ? 'auto' : 'none'}
            style={[styles.stickyIdentity, {opacity: showSticky ? 1 : 0}]}
            testID="module-sticky-install">
            <ModuleArtwork moduleId={module.moduleId} name={copy.name} size={28} />
            <AppText variant="label" numberOfLines={1} style={styles.flex}>
              {copy.name}
            </AppText>
            <ModuleAction
              presentation={presentation}
              productName={copy.name}
              onPress={presentation.primaryAction === 'Open' ? openModule : openPreview}
            />
          </View>
          <ChromeGlassControlGroup
            items={[
              {
                kind: 'button',
                icon: 'share',
                accessibilityLabel: `Share ${copy.name}`,
                onPress: shareModule,
              },
              {
                kind: 'menu',
                accessibilityLabel: `${copy.name} actions`,
                title: copy.name,
                actions: overflowActions,
                onAction: id => {
                  if (id === 'share') shareModule()
                  if (id === 'hub') router.push('/product' as Href)
                  if (id === 'enable') void transition('enable')
                  if (id === 'disable') void transition('disable')
                  if (id === 'update') void transition('update')
                  if (id === 'uninstall') void transition('uninstall')
                  if (id === 'settings') {
                    router.push(
                      `/settings/modules/${encodeURIComponent(module.moduleId)}` as Href,
                    )
                  }
                },
              },
            ]}
          />
        </View>
      </View>

      <ResponsiveContent maxWidth={780}>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[6], paddingBottom: tabPadding + spacing[6]}]}
          keyboardShouldPersistTaps="handled"
          onScroll={event => {
            const visible = event.nativeEvent.contentOffset.y < 220
            setHeroActionVisible(current => (current === visible ? current : visible))
          }}
          scrollEventThrottle={16}>
          <View style={[styles.hero, {gap: spacing[4]}]}>
            <View style={styles.heroArt}>
              <ModuleArtwork moduleId={module.moduleId} name={copy.name} variant="scene" />
            </View>
            <View style={{gap: spacing[1]}}>
              {copy.eyebrow ? (
                <AppText variant="micro" colour="textTertiary">
                  {copy.eyebrow.toUpperCase()}
                </AppText>
              ) : null}
              <AppText variant="display">{copy.name}</AppText>
              <AppText variant="body" colour="textSecondary">{copy.short}</AppText>
              <AppText variant="caption" colour="textTertiary">
                {copy.publisher}
                {module.trustLevel === 'firstParty' ? '  ·  Modula' : ''}
              </AppText>
            </View>
            <View testID="module-hero-install">
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
                  productName={copy.name}
                  onPreview={openPreview}
                  onOpen={openModule}
                  onEnable={() => void transition('enable')}
                  onUpdate={() => void transition('update')}
                />
              )}
            </View>
            <ProductStatsRow
              items={[
                {
                  label: 'Version',
                  value: module.latestVersion ?? '—',
                  detail: 'Package',
                },
                {
                  label: 'Status',
                  value: installLabel,
                  detail: module.installable ? 'Installable' : 'Preview',
                },
                {
                  label: 'Publisher',
                  value: copy.publisher,
                  detail: module.trustLevel === 'firstParty' ? 'First party' : 'Listed',
                },
              ]}
            />
            <View style={styles.metaRow}>
              <MetaChip label="Private data" />
              {module.standard?.standardVersion ? <MetaChip label="Module Standard" /> : null}
            </View>
          </View>

          <View style={[styles.rule, {backgroundColor: colours.separator}]} />

          <View style={{gap: spacing[2]}}>
            <SectionHeader title={`What ${copy.name} does`} icon="note" />
            <AppText variant="body" colour="textSecondary">{copy.whatItDoes}</AppText>
          </View>

          <ModulePreview moduleId={module.moduleId} name={copy.name} />

          <Disclosure
            title="What's New"
            icon="update"
            summary={`Version ${module.latestVersion ?? 'unreleased'}`}
            body={releaseNotes.length ? releaseNotes.join('\n') : 'Folders, search and lifecycle improvements.'}
          />

          <Disclosure
            title="Privacy & Access"
            icon="privacy"
            summary={copy.privacy}
            open={privacyOpen}
            onToggle={() => setPrivacyOpen(open => !open)}
            body="Records stay account-scoped. Other accounts cannot read them."
          />

          <SectionHeader
            title={`Made by ${copy.publisher}`}
            icon="modules"
            onPress={() => router.push('/product' as Href)}
          />

          <SectionHeader
            title="Trust & Technical Details"
            icon="security"
            trailing={technicalOpen ? 'Hide' : 'Show'}
            onPress={() => setTechnicalOpen(open => !open)}
          />
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
        onInstall={() => void installModule(false)}
        onInstallAndEnable={() => void installModule(true)}
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
  icon,
  summary,
  body,
  open,
  onToggle,
}: {
  title: string
  icon?: ModulaIconName
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
      <SectionHeader
        title={title}
        icon={icon}
        subtitle={summary}
        trailing={shown ? 'Hide' : 'Show'}
        onPress={onToggle ?? (() => setLocalOpen(value => !value))}
      />
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
  productName,
  onPreview,
  onOpen,
  onEnable,
  onUpdate,
}: {
  state: ModuleInstallationState
  busy: string | null
  moduleId: string
  installable: boolean
  latestVersion?: string | null
  priceState?: ModuleDetail['priceState']
  productName: string
  onPreview: () => void
  onOpen: () => void
  onEnable: () => void
  onUpdate: () => void
}) {
  const presentation = resolveModuleInstallPresentation({
    moduleId,
    installable,
    installationState: state,
    priceState,
    latestVersion,
  })
  const loading =
    (presentation.primaryAction === 'Enable' && busy === 'enable') ||
    (presentation.primaryAction === 'Update' && busy === 'update') ||
    (presentation.primaryAction === 'Install' &&
      (busy === 'install' || busy === 'install-enable'))
  const onPrimary = () => {
    if (presentation.primaryAction === 'Open') {
      onOpen()
      return
    }
    if (presentation.primaryAction === 'Enable') {
      onEnable()
      return
    }
    if (presentation.primaryAction === 'Update') {
      onUpdate()
      return
    }
    onPreview()
  }
  return (
    <View style={styles.actions}>
      <ModuleAction
        presentation={presentation}
        productName={productName}
        loading={loading}
        onPress={onPrimary}
      />
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
  actions: {alignItems: 'flex-start'},
  chrome: {width: '100%'},
  chromeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 12,
    minHeight: 52,
  },
  content: {padding: 16},
  flex: {flex: 1, minWidth: 0},
  hero: {alignItems: 'stretch'},
  heroArt: {borderRadius: 24, marginHorizontal: -16, overflow: 'hidden'},
  infoRow: {gap: 2},
  metaRow: {flexDirection: 'row', flexWrap: 'wrap'},
  rule: {height: StyleSheet.hairlineWidth, width: '100%'},
  screen: {flex: 1},
  stickyIdentity: {alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0},
})
