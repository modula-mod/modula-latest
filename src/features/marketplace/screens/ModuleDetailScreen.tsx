import {useEffect, useState} from 'react'
import {Alert, Platform, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useLocalSearchParams, useRouter, type Href, Link} from 'expo-router'
import {StatusBar} from 'expo-status-bar'
import {useQueryClient} from '@tanstack/react-query'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useSession} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import type {GreenfieldRegistryDeclaration, ModuleDetail, ModuleInstallPreview, ModuleProductRelationship} from '@/data/repositories/contracts'
import {InstallPreviewSheet} from '@/features/modules/components/InstallPreviewSheet'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import type {ModuleInstallStageId} from '@/features/modules/components/ModuleInstallProgress'
import {
  ProductActionGroup,
  ProductCapabilityStrip,
  ProductCover,
  ProductDescription,
  ProductIdentity,
  ProductInformationDisclosure,
  ProductInformationStrip,
  ProductMetadataStrip,
  ProductPlatformRow,
  ProductPreviewCarousel,
  ProductRatingPanel,
  ProductFixedChrome,
  ProductStickyHeader,
  ProductTabs,
  ProductWhatsNew,
  productTrailingCapsuleWidth,
  type ProductCapabilityItem,
  type ProductInformationItem,
  type ProductMetadataItem,
  type ProductPreviewFrame,
  type ProductTabId,
} from '@/features/modules/components/product-detail'
import {isInstalledModuleState, resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {presentPermissions} from '@/features/modules/identity/permissionPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useModuleDetailQuery, useModuleRelationshipsQuery} from '@/features/modules/hooks'
import {moduleQueryKeys} from '@/features/modules/state/moduleQueryKeys'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {shareModulaText} from '@/platform/ui/share/share-modula-text'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {CANONICAL_VAULT_NOTES_CURRENT_VERSION, isVaultNotesModuleId} from '@modula/greenfield-contracts'

const VAULT_NOTES_CANONICAL_SOURCE = 'modula-mod/modula-vault-notes'

export function ModuleDetailScreen() {
  const {moduleId, install} = useLocalSearchParams<{moduleId: string; install?: string}>()
  const id = String(moduleId ?? '')
  const router = useRouter()
  const services = useAppServices()
  const session = useSession()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const {width} = useWindowDimensions()
  const {colours, scheme, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const detail = useModuleDetailQuery(id)
  const relationships = useModuleRelationshipsQuery(id)
  const module = detail.data
  const [preview, setPreview] = useState<ModuleInstallPreview | null>(null)
  const [installSheetOpen, setInstallSheetOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [installStage, setInstallStage] = useState<ModuleInstallStageId | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<ProductTabId>('overview')
  const [informationOpen, setInformationOpen] = useState<string | null>(null)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [heroActionBottom, setHeroActionBottom] = useState(360)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [ratingBusy, setRatingBusy] = useState(false)
  const [userRating, setUserRating] = useState<number | null>(null)

  const installRequested = install === '1' || install === 'true'
  const installReviewOpen = installSheetOpen || installRequested

  const refreshCatalogue = async () => {
    await Promise.all([
      detail.refetch(),
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.catalogueRoot}),
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.installed}),
    ])
  }

  useEffect(() => {
    if (!installReviewOpen || !module || preview) return
    let cancelled = false
    void services.moduleRepository
      .installPreview(module.moduleId, module.latestVersion ?? undefined, productPlatform())
      .then(next => {
        if (!cancelled) setPreview(next)
      })
      .catch(error => {
        if (cancelled) return
        console.warn('Product Hub install preview failed', error)
        Alert.alert(`${module.name} couldn’t be prepared`, 'Try again in a moment.')
      })
    return () => {
      cancelled = true
    }
  }, [installReviewOpen, module, preview, services.moduleRepository])

  const installModule = async (enable: boolean) => {
    if (!module) return
    setBusy(enable ? 'install-enable' : 'install')
    setInstallError(null)
    setInstallStage('resolving')
    try {
      const nextPreview = preview ?? await services.moduleRepository.installPreview(module.moduleId, module.latestVersion ?? undefined, productPlatform())
      setPreview(nextPreview)
      setInstallStage('compatibility')
      if (nextPreview.compatible === false) {
        throw new Error(nextPreview.incompatibilityReasons.join(', ') || 'This module is not compatible.')
      }
      setInstallStage('installing')
      await services.moduleRepository.install(module.moduleId, {
        version: module.latestVersion ?? undefined,
        platform: productPlatform(),
        approvedPermissions: nextPreview.permissions.map(permission => permission.permission),
      })
      if (enable) {
        setInstallStage('enabling')
        await services.moduleRepository.enable(module.moduleId)
      }
      await refreshCatalogue()
      setInstallStage('ready')
    } catch (error) {
      console.warn('Product Hub install failed', error)
      const message = `${module.name} couldn’t be installed. Try again.`
      setInstallStage('failed')
      setInstallError(message)
      Alert.alert(`${module.name} couldn’t be installed`, 'Try again.')
    } finally {
      setBusy(null)
    }
  }

  const transition = async (kind: 'enable' | 'disable' | 'update' | 'uninstall') => {
    if (!module) return
    let removeDependants = false
    if (kind === 'disable') {
      const confirmed = await confirmModulaAction({
        title: `Disable ${module.name}?`,
        message: 'Your retained module data remains available if you enable it again.',
        confirmLabel: 'Disable',
        cancelLabel: 'Cancel',
      })
      if (!confirmed) return
    }
    if (kind === 'uninstall') {
      const uninstallPreview = await services.moduleRepository.uninstallPreview(module.moduleId)
      const dependants = [
        ...uninstallPreview.dependantModules.map(item => String((item as {module_id?: unknown}).module_id ?? 'dependent module')),
        ...uninstallPreview.dependantExtensions.map(item => item.productId),
      ]
      const confirmed = await confirmModulaAction({
        title: `Uninstall ${module.name}?`,
        message: dependants.length
          ? `${dependants.join(', ')} depend on ${module.name}. Remove these products and keep their data?`
          : 'This keeps your module data for a future reinstall.',
        confirmLabel: dependants.length ? 'Remove products, keep data' : 'Uninstall and keep data',
        cancelLabel: 'Cancel',
        destructive: true,
      })
      if (!confirmed) return
      removeDependants = dependants.length > 0
    }
    setBusy(kind)
    try {
      if (kind === 'enable') await services.moduleRepository.enable(module.moduleId)
      if (kind === 'disable') await services.moduleRepository.disable(module.moduleId)
      if (kind === 'update') await services.moduleRepository.update(module.moduleId)
      if (kind === 'uninstall') await services.moduleRepository.uninstall(module.moduleId, 'keepData', {removeDependants})
      await refreshCatalogue()
    } catch (error) {
      console.warn('Product Hub module action failed', error)
      Alert.alert(`${module.name} couldn’t be updated`, 'Try again.')
    } finally {
      setBusy(null)
    }
  }

  const rateModule = async (rating: number) => {
    if (!module || ratingBusy) return
    setRatingBusy(true)
    try {
      await services.moduleRepository.rateModule(module.moduleId, rating)
      setUserRating(rating)
      await detail.refetch()
    } catch (error) {
      console.warn('Product Hub rating failed', error)
      Alert.alert('Rating wasn’t saved', 'Try again in a moment.')
    } finally {
      setRatingBusy(false)
    }
  }

  if (detail.isPending) {
    return <ProductDetailSkeleton top={insets.top} />
  }

  if (!module) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas, paddingTop: insets.top}]}>
        <EmptyState
          icon="marketplace"
          title="This product isn’t available right now."
          description="Return to Product Hub to discover other modules."
          action={<ModulaButton label="Return to Product Hub" role="secondary" onPress={() => router.replace('/product' as Href)} />}
        />
      </View>
    )
  }

  const copy = productCopyFor(module.moduleId, module.name, module.longDescription || module.description)
  const presentation = resolveModuleInstallPresentation(module)
  const installed = isInstalledModuleState(module.installationState)
  const platforms = platformsFor(module)
  const releaseNotes = module.releaseNotes?.filter(Boolean) ?? []
  const metadata = metadataFor(module)
  const capabilities = capabilitiesFor(module, platforms)
  const information = informationFor(module)
  const permissionGroups = presentPermissions(module.permissions, copy.name).groups
  const previewFrames = previewsFor(module)
  const stackedIdentity = width < 330
  const heroArtworkSize = Math.min(116, Math.max(94, Math.round(width * 0.25)))
  const stickyStart = Math.max(0, heroActionBottom - insets.top - 48)
  const stickyProgress = Math.min(1, Math.max(0, (scrollOffset - stickyStart) / 56))

  const openModule = () => router.push(`/module/${encodeURIComponent(module.moduleId)}` as Href)
  const openInstall = () => {
    setInstallError(null)
    setInstallStage(null)
    setInstallSheetOpen(true)
  }
  const dismissInstall = () => {
    setInstallSheetOpen(false)
    if (installRequested) router.setParams({install: ''})
  }
  const onPrimary = () => {
    if (presentation.primaryAction === 'Open') return openModule()
    if (presentation.primaryAction === 'Enable') return void transition('enable')
    if (presentation.primaryAction === 'Update') return void transition('update')
    if (presentation.primaryAction === 'Install') return openInstall()
  }
  const shareModule = () => void shareModulaText({title: copy.name, message: `${copy.name} — ${copy.short}`})
  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/product' as Href)
  }
  const overflowActions: ModulaActionItem[] = [
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
    ...(installed ? [{id: 'settings', label: 'Configure', icon: 'settings' as const}] : []),
    ...(installed ? [{id: 'uninstall', label: 'Uninstall', icon: 'trash' as const, style: 'destructive' as const}] : []),
  ]
  const onOverflow = (actionId: string) => {
    if (actionId === 'hub') router.push('/product' as Href)
    if (actionId === 'enable') void transition('enable')
    if (actionId === 'disable') void transition('disable')
    if (actionId === 'update') void transition('update')
    if (actionId === 'uninstall') void transition('uninstall')
    if (actionId === 'settings') router.push(`/settings/modules/${encodeURIComponent(module.moduleId)}` as Href)
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <StatusBar style={stickyProgress > 0.5 || scrollOffset >= 210 ? (scheme === 'dark' ? 'light' : 'dark') : 'light'} />
      <ResponsiveContent maxWidth={920}>
        <ScrollView
          contentContainerStyle={{paddingBottom: tabPadding + spacing[8]}}
          keyboardShouldPersistTaps="handled"
          onScroll={event => setScrollOffset(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}>
          <View style={styles.coverRegion}>
            <Link.AppleZoomTarget>
              <ProductCover
                moduleId={module.moduleId}
                name={copy.name}
                inset={false}
                transitionToCanvas
              />
            </Link.AppleZoomTarget>
          </View>

          <View
            style={[
              styles.productLead,
              {gap: spacing[3], marginTop: -60, paddingHorizontal: spacing[4]},
            ]}>
            <View style={[styles.identityRow, stackedIdentity && styles.identityStack, {gap: spacing[4]}]}>
              <ModuleArtwork moduleId={module.moduleId} name={copy.name} size={heroArtworkSize} variant="hero" />
              <View style={[styles.identityCopy, {paddingTop: stackedIdentity ? 0 : spacing[1]}]}>
                <ProductIdentity
                  name={copy.name}
                  subtitle={copy.short}
                  publisher={copy.publisher}
                  privateByDesign={isVaultNotesModuleId(module.moduleId)}
                  verified={module.trustLevel === 'firstParty'}
                />
                <View
                  onLayout={event => {
                    const {y, height} = event.nativeEvent.layout
                    setHeroActionBottom(y + height + 230)
                  }}
                  style={{marginTop: spacing[2]}}
                  testID="module-hero-install">
                  <ProductActionGroup
                    presentation={presentation}
                    productName={copy.name}
                    loading={Boolean(busy)}
                    onPrimary={onPrimary}
                  />
                </View>
              </View>
            </View>

            <ProductMetadataStrip items={metadata} />
            <ProductTabs selected={selectedTab} onSelect={setSelectedTab} />
          </View>

          <View
            style={[
              styles.editorialBody,
              {gap: spacing[6], paddingHorizontal: spacing[4], paddingTop: spacing[4]},
            ]}>
            <TabContent
              tab={selectedTab}
              module={module}
              productName={copy.name}
              description={copy.whatItDoes}
              capabilities={capabilities}
              platforms={platforms}
              releaseNotes={releaseNotes}
              releaseDate={module.releasePublishedAt}
              previewFrames={previewFrames}
              information={information}
              informationOpen={informationOpen}
              onInformation={id => setInformationOpen(current => current === id ? null : id)}
              permissionGroups={permissionGroups}
              versionHistoryOpen={versionHistoryOpen}
              onVersionHistory={() => setVersionHistoryOpen(current => !current)}
              onProductHub={() => router.push('/product' as Href)}
              extensions={relationships.data?.extensions ?? []}
              targets={relationships.data?.targets ?? []}
              onExtension={productId => router.push(`/marketplace/${encodeURIComponent(productId)}` as Href)}
              canRate={session.status === 'signedIn'}
              ratingBusy={ratingBusy}
              userRating={userRating}
              onRate={rating => void rateModule(rating)}
            />
          </View>
        </ScrollView>
      </ResponsiveContent>

      <ProductStickyHeader
        moduleId={module.moduleId}
        name={copy.name}
        progress={stickyProgress}
        top={insets.top}
        trailingReservedWidth={productTrailingCapsuleWidth(stickyProgress > 0.1 ? 1 : 0)}
      />

      <ProductFixedChrome
        actions={overflowActions}
        onAction={onOverflow}
        onBack={goBack}
        onPrimary={onPrimary}
        onShare={shareModule}
        presentation={presentation}
        productName={copy.name}
        progress={stickyProgress}
        top={insets.top + spacing[2]}
      />

      <InstallPreviewSheet
        module={module}
        preview={preview}
        isPresented={installReviewOpen}
        pending={Boolean(busy)}
        stage={installStage}
        failed={installError}
        onDismiss={dismissInstall}
        onInstall={() => void installModule(false)}
        onInstallAndEnable={() => void installModule(true)}
        onOpen={openModule}
      />
    </View>
  )
}

function productPlatform(): 'ios' | 'android' | 'web' | 'desktop' {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') return Platform.OS
  return 'desktop'
}

function TabContent({
  tab,
  module,
  productName,
  description,
  capabilities,
  platforms,
  releaseNotes,
  releaseDate,
  previewFrames,
  information,
  informationOpen,
  onInformation,
  permissionGroups,
  versionHistoryOpen,
  onVersionHistory,
  onProductHub,
  extensions,
  targets,
  onExtension,
  canRate,
  ratingBusy,
  userRating,
  onRate,
}: {
  tab: ProductTabId
  module: ModuleDetail
  productName: string
  description: string
  capabilities: ProductCapabilityItem[]
  platforms: string[]
  releaseNotes: string[]
  releaseDate?: string | null
  previewFrames: ProductPreviewFrame[]
  information: ProductInformationItem[]
  informationOpen: string | null
  onInformation: (id: string) => void
  permissionGroups: ReturnType<typeof presentPermissions>['groups']
  versionHistoryOpen: boolean
  onVersionHistory: () => void
  onProductHub: () => void
  extensions: ModuleProductRelationship[]
  targets: ModuleProductRelationship[]
  onExtension: (productId: string) => void
  canRate: boolean
  ratingBusy: boolean
  userRating: number | null
  onRate: (rating: number) => void
}) {
  const {spacing} = useThemeTokens()

  if (tab === 'features') {
    return (
      <>
        <ProductCapabilityStrip items={capabilities} />
        <ProductPreviewCarousel productName={productName} frames={previewFrames} />
        <ProductPlatformRow platforms={platforms} />
        <ProductDescription>{description}</ProductDescription>
      </>
    )
  }

  if (tab === 'permissions') {
    return (
      <View style={{gap: spacing[5]}}>
        <AppText variant="headline" accessibilityRole="header">What {productName} can use</AppText>
        {permissionGroups.map(group => (
          <View key={group.id} style={{gap: spacing[1]}}>
            <AppText variant="label">{group.title}</AppText>
            <AppText variant="body" colour="textSecondary">{group.summary}</AppText>
          </View>
        ))}
        <AppText variant="caption" colour="textTertiary">
          Technical permission names are available in Information.
        </AppText>
      </View>
    )
  }

  if (tab === 'reviews') {
    return (
      <ProductRatingPanel
        rating={module.marketplace?.rating ?? {average: null, count: 0, updatedAt: null}}
        canRate={canRate}
        selectedRating={userRating}
        busy={ratingBusy}
        onRate={onRate}
      />
    )
  }

  if (tab === 'related') {
    return (
      <View style={{gap: spacing[3]}}>
        {targets.length ? (
          <View style={{gap: spacing[2]}}>
            <AppText variant="headline" accessibilityRole="header">Works with</AppText>
            <ExtensionRelationshipList extensions={targets} onOpen={onExtension} />
          </View>
        ) : null}
        <AppText variant="headline" accessibilityRole="header">Extends {productName}</AppText>
        <ExtensionRelationshipList extensions={extensions} onOpen={onExtension} />
        <AppText variant="body" colour="textSecondary">Discover more products from {module.publisherName} in Product Hub.</AppText>
        <ModulaButton label="Explore Product Hub" role="secondary" onPress={onProductHub} />
      </View>
    )
  }

  return (
    <>
      <ProductCapabilityStrip items={capabilities} />
      <ProductWhatsNew
        version={module.latestVersion}
        releaseDate={releaseDate}
        releaseNotes={releaseNotes}
        versionHistoryOpen={versionHistoryOpen}
        onVersionHistory={module.latestVersion ? onVersionHistory : undefined}
      />
      <ProductPreviewCarousel productName={productName} frames={previewFrames} />
      <ProductPlatformRow platforms={platforms} />
      <ProductDescription>{description}</ProductDescription>
      {targets.length ? (
        <View style={{gap: spacing[3]}}>
          <AppText variant="sectionTitle" accessibilityRole="header">Works with</AppText>
          <ExtensionRelationshipList extensions={targets} onOpen={onExtension} />
        </View>
      ) : null}
      {extensions.length ? (
        <View style={{gap: spacing[3]}}>
          <AppText variant="sectionTitle" accessibilityRole="header">Add-ons and plugins</AppText>
          <ExtensionRelationshipList extensions={extensions} onOpen={onExtension} />
        </View>
      ) : null}
      <View style={{gap: spacing[3]}}>
        <AppText variant="sectionTitle" accessibilityRole="header">Module Information</AppText>
        <ProductInformationStrip items={information.map(item => ({...item, onPress: () => onInformation(item.id)}))} />
        {informationOpen ? <InformationDetail module={module} section={informationOpen} /> : null}
        <ProductInformationDisclosure label="Information" onPress={() => onInformation(informationOpen ?? 'privacy')} />
      </View>
    </>
  )
}

function ExtensionRelationshipList({extensions, onOpen}: {extensions: ModuleProductRelationship[]; onOpen: (productId: string) => void}) {
  const {colours, radius, spacing} = useThemeTokens()
  if (!extensions.length) return <AppText variant="body" colour="textSecondary">No compatible extensions are published yet.</AppText>
  return (
    <View style={{gap: spacing[2]}}>
      {extensions.map(extension => (
        <View key={extension.productId} style={[styles.relationshipRow, {borderColor: colours.border, borderRadius: radius.large, gap: spacing[2], padding: spacing[3]}]}>
          <View style={{flex: 1, gap: spacing[1]}}>
            <AppText variant="label">{extension.name}</AppText>
            <AppText variant="caption" colour="textSecondary">{extension.description}</AppText>
            <AppText variant="micro" colour="textTertiary">{extension.productKind} · {extension.version} · requires {extension.versionRange}</AppText>
          </View>
          <ModulaButton label="View" role="secondary" accessibilityLabel={`View ${extension.name}`} onPress={() => onOpen(extension.productId)} />
        </View>
      ))}
    </View>
  )
}

function InformationDetail({module, section}: {module: ModuleDetail; section: string}) {
  const {colours, radius, spacing} = useThemeTokens()
  const vault = isVaultNotesModuleId(module.moduleId)
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.informationDetail,
        {backgroundColor: colours.surface, borderColor: colours.border, borderRadius: radius.large, gap: spacing[2]},
      ]}>
      {section === 'privacy' ? (
        <>
          <AppText variant="label">Privacy</AppText>
          <AppText variant="body" colour="textSecondary">
            {module.privacy || 'Module records are scoped to the current Modula account.'}
          </AppText>
          <InfoRow label="Data access" value={module.permissions.length ? 'Declared before installation' : 'No data permissions declared'} />
          <InfoRow label="Uninstall" value="Keep-data uninstall is the default" />
        </>
      ) : null}
      {section === 'source' ? (
        <>
          <AppText variant="label">Trust and provenance</AppText>
          <InfoRow label="Licence" value={licenseLabelFor(module)} />
          <InfoRow label="Canonical repository" value={vault ? VAULT_NOTES_CANONICAL_SOURCE : module.sourceRepository || 'Not declared'} />
          <InfoRow label="Registry release" value={module.latestVersion ?? 'Not published'} />
          {vault ? <InfoRow label="Canonical source release" value={CANONICAL_VAULT_NOTES_CURRENT_VERSION} /> : null}
          <InfoRow label="Registry source" value={module.sourceRepository || 'Not declared'} />
          <InfoRow label="Commit" value={module.sourceCommit || 'Not declared'} />
        </>
      ) : null}
      {section === 'price' ? (
        <>
          <AppText variant="label">In-App Purchases</AppText>
          <AppText variant="body" colour="textSecondary">
            {inAppPurchaseLabelFor(module)}. The registry listing is {module.priceState.toLowerCase()}.
          </AppText>
        </>
      ) : null}
      {section === 'developer' ? (
        <>
          <AppText variant="label">Developer</AppText>
          <InfoRow label="Publisher" value={module.publisherName} />
          <InfoRow label="Trust" value={module.trustLevel === 'firstParty' ? 'Verified Modula publisher' : module.trustLevel} />
        </>
      ) : null}
      {section === 'technical' ? (
        <>
          <AppText variant="label">Backend</AppText>
          <InfoRow label="Mode" value={backendModeLabel(module.backend.mode)} />
          <InfoRow label="Provider" value={module.backend.provider} />
          <InfoRow label="Deployment" value={displayLabel(module.backend.deploymentOwnership)} />
          <InfoRow label="Endpoint" value={module.backend.endpoint ?? 'Resolved during installation'} />
          <InfoRow label="Protocol" value={module.backend.protocolVersion ?? 'Not required'} />
          <InfoRow label="Status" value={displayLabel(module.backend.status)} />
          <InfoRow label="Self-hosting" value={module.backend.selfHostingSupported ? 'Supported' : 'Not supported'} />
          <InfoRow label="External data processing" value={module.backend.externalDataProcessing ? 'Yes' : 'No'} />
          <AppText variant="label">Data location</AppText>
          <InfoRow label="Primary store" value={dataLocationLabel(module.backend.dataLocation)} />
          <InfoRow label="Regions" value={module.backend.regions.length ? module.backend.regions.join(', ') : 'Not declared'} />
          <InfoRow label="Platform permissions" value={permissionList(platformPermissions(module))} />
          <InfoRow label="Module backend permissions" value={permissionList(module.backend.backendPermissions)} />
          <InfoRow label="External service permissions" value={permissionList(externalPermissions(module))} />
          <AppText variant="label">Technical permissions</AppText>
          {module.permissions.map(permission => (
            <InfoRow key={permission.permission} label={permission.permission} value={permission.reason} />
          ))}
        </>
      ) : null}
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

function licenseLabelFor(module: ModuleDetail): string {
  const manifest = module.normalizedManifest ?? module.manifest ?? {}
  const licence = asRecord(manifest.license)
  return stringOrNull(licence?.spdx) ?? 'Not declared'
}

function inAppPurchaseLabelFor(module: ModuleDetail): string {
  const declared = declaredValue(module.marketplace?.inAppPurchases)
  if (declared === true) return 'This release declares in-app purchases'
  if (declared === false) return 'This release declares no in-app purchases'
  const value = marketplaceMetadataFor(module).inAppPurchases
  if (value === true) return 'This release declares in-app purchases'
  if (value === false) return 'This release declares no in-app purchases'
  return 'In-app purchase metadata is not declared for this release'
}

function metadataFor(module: ModuleDetail): ProductMetadataItem[] {
  const marketplace = marketplaceMetadataFor(module)
  const reviews = asRecord(marketplace.reviews)
  const average = module.marketplace?.rating.average ?? numberOrNull(marketplace.rating ?? reviews?.average)
  const reviewCount = module.marketplace?.rating.count ?? numberOrNull(marketplace.ratingCount ?? reviews?.count)
  const age = declaredValue(module.marketplace?.ageRating) ?? stringOrNull(marketplace.ageRating)
  const chartRank = module.marketplace?.chart?.rank ?? numberOrNull(marketplace.chartRank)
  const packageSize = module.releaseSizeBytes ?? numberOrNull(marketplace.packageSizeBytes)

  return [
    {
      id: 'rating',
      value: average === null ? '—' : average.toFixed(1),
      label: 'Rating',
      detail: average !== null && reviewCount !== null ? `${Math.round(reviewCount).toLocaleString()} ratings` : undefined,
    },
    {id: 'age', value: age ?? '—', label: 'Age'},
    {id: 'chart', value: chartRank === null ? '—' : `#${Math.round(chartRank)}`, label: 'Chart'},
    {id: 'developer', value: module.publisherName, label: 'Developer'},
    {id: 'size', value: formatBytes(packageSize), label: 'Size'},
    {id: 'version', value: module.latestVersion ?? '—', label: 'Version'},
  ]
}

function capabilitiesFor(module: ModuleDetail, platforms: string[]): ProductCapabilityItem[] {
  const manifest = module.normalizedManifest ?? module.manifest ?? {}
  const privacy = declaredValue(module.marketplace?.privacy)
  const privateRecords = privacy !== null || (!module.marketplace && (Boolean(module.privacy) || module.permissions.some(permission => /record|note|folder/i.test(permission.permission))))
  const offline = module.marketplace
    ? booleanDeclarationPresentation(module.marketplace.offlineSupport, 'offline support')
    : declarationPresentation(asRecord(manifest.offline), 'offline support')
  const sync = module.marketplace
    ? booleanDeclarationPresentation(module.marketplace.syncSupport, 'sync support')
    : declarationPresentation(asRecord(manifest.realtime), 'sync support')

  return [
    {
      id: 'privacy',
      icon: 'privacy',
      label: 'Private',
      value: privateRecords ? 'Private' : 'Not declared',
      detail: privateRecords ? privacy ?? 'Account-scoped data' : 'No privacy declaration',
    },
    {id: 'offline', icon: 'storage', label: 'Offline', ...offline},
    {id: 'sync', icon: 'update', label: 'Sync', ...sync},
    {
      id: 'platforms',
      icon: 'module',
      label: 'Platforms',
      value: platforms.length ? platforms.map(platformLabel).join(', ') : 'Not declared',
      detail: platforms.length ? module.compatibility : 'No platform declaration',
    },
  ]
}

function informationFor(module: ModuleDetail): ProductInformationItem[] {
  const manifest = module.normalizedManifest ?? module.manifest ?? {}
  const license = asRecord(manifest.license)
  const marketplace = marketplaceMetadataFor(module)
  const spdx = stringOrNull(license?.spdx)
  const typedIap = declaredValue(module.marketplace?.inAppPurchases)
  const inAppPurchases = typedIap !== null
    ? typedIap ? 'Declared' : 'None'
    : typeof marketplace.inAppPurchases === 'boolean'
      ? marketplace.inAppPurchases ? 'Declared' : 'None'
      : 'Not declared'
  const privacy = declaredValue(module.marketplace?.privacy)
  const privateRecords = privacy !== null || (!module.marketplace && (Boolean(module.privacy) || module.permissions.some(permission => /record|note|folder/i.test(permission.permission))))
  const openSource = spdx && !/^LicenseRef-/i.test(spdx) ? spdx : 'Not declared'

  return [
    {id: 'privacy', icon: 'privacy', label: 'Privacy', value: privateRecords ? 'Private' : 'Not declared'},
    {id: 'source', icon: 'verified', label: 'Source', value: openSource},
    {id: 'price', icon: 'marketplace', label: 'In-App Purchases', value: inAppPurchases},
    {id: 'developer', icon: 'profile', label: 'Developer', value: module.publisherName},
  ]
}

function platformsFor(module: ModuleDetail): string[] {
  const manifestCompatibility = asRecord(module.normalizedManifest?.compatibility ?? module.manifest?.compatibility)
  const declared = Array.isArray(manifestCompatibility?.platforms)
    ? manifestCompatibility.platforms.map(String)
    : []
  const compatibility = module.compatibility.toLowerCase()
  const inferred = ['ios', 'android', 'web'].filter(platform => compatibility.includes(platform))
  return [...new Set([...declared, ...inferred].map(platform => platform.toLowerCase()))]
}

function platformLabel(platform: string): string {
  if (platform === 'ios') return 'iOS'
  if (platform === 'android') return 'Android'
  if (platform === 'web') return 'Web'
  return platform
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function marketplaceMetadataFor(module: ModuleDetail): Record<string, unknown> {
  const normalized = module.normalizedManifest ?? {}
  const manifest = module.manifest ?? {}
  const normalizedExtensions = asRecord(normalized.extensions)
  const manifestExtensions = asRecord(manifest.extensions)
  return asRecord(normalized.marketplace)
    ?? asRecord(normalizedExtensions?.marketplace)
    ?? asRecord(manifest.marketplace)
    ?? asRecord(manifestExtensions?.marketplace)
    ?? {}
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(number) && number >= 0 ? number : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function platformPermissions(module: ModuleDetail): string[] {
  const backend = new Set(module.backend.backendPermissions)
  return module.permissions
    .map(permission => permission.permission)
    .filter(permission => !backend.has(permission) && !isExternalPermission(permission))
}

function externalPermissions(module: ModuleDetail): string[] {
  return module.permissions
    .map(permission => permission.permission)
    .filter(isExternalPermission)
}

function isExternalPermission(permission: string): boolean {
  return permission.startsWith('network:') || permission.startsWith('connector:') || permission.startsWith('dimon:')
}

function permissionList(permissions: string[]): string {
  return permissions.length ? permissions.join(', ') : 'None declared'
}

function backendModeLabel(mode: ModuleDetail['backend']['mode']): string {
  if (mode === 'greenfield-managed') return 'Greenfield-managed'
  if (mode === 'module-managed') return 'Module-managed'
  if (mode === 'frontend-only') return 'Frontend-only'
  return 'Hybrid'
}

function dataLocationLabel(value: string): string {
  if (value === 'greenfield') return 'Greenfield'
  if (value === 'module-backend') return 'Module provider'
  if (value === 'device') return 'Device'
  return displayLabel(value)
}

function displayLabel(value: string): string {
  return value.replace(/-/g, ' ').replace(/^./, char => char.toUpperCase())
}

function formatBytes(value: number | null): string {
  if (value === null) return '—'
  if (value < 1024) return `${Math.round(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function declarationPresentation(
  declaration: Record<string, unknown> | null,
  label: string,
): Pick<ProductCapabilityItem, 'value' | 'detail'> {
  if (!declaration) return {value: 'Not declared', detail: `No verified ${label}`}
  const explicitlyTrue = declaration.enabled === true || declaration.supported === true
  if (declaration.enabled === false || declaration.supported === false) {
    return {value: 'Not supported', detail: 'Disabled by manifest'}
  }
  if (explicitlyTrue) return {value: 'Supported', detail: 'Declared by manifest'}
  return {value: 'Not declared', detail: `No verified ${label}`}
}

function declaredValue<T>(declaration: GreenfieldRegistryDeclaration<T> | undefined): T | null {
  return declaration?.state === 'declared' ? declaration.value : null
}

function booleanDeclarationPresentation(
  declaration: GreenfieldRegistryDeclaration<boolean>,
  label: string,
): Pick<ProductCapabilityItem, 'value' | 'detail'> {
  if (declaration.state === 'unknown') return {value: 'Not declared', detail: `No verified ${label}`}
  return declaration.value
    ? {value: 'Supported', detail: 'Declared by publisher'}
    : {value: 'Not supported', detail: 'Declared by publisher'}
}

function previewsFor(module: ModuleDetail): ProductPreviewFrame[] {
  if (module.marketplace) {
    return module.marketplace.previews.map((preview, index) => ({
      id: preview.id,
      type: preview.type,
      headline: preview.alt ?? `Preview ${index + 1}`,
      accessibilityLabel: preview.alt ?? `${module.name} ${preview.type} preview ${index + 1}`,
      source: preview.source,
      posterSource: preview.posterSource,
    }))
  }
  const marketplace = marketplaceMetadataFor(module)
  const rows = Array.isArray(marketplace.previews)
    ? marketplace.previews
    : Array.isArray(marketplace.screenshots)
      ? marketplace.screenshots
      : []

  return rows.flatMap((value, index) => {
    const row = asRecord(value)
    const source = typeof value === 'string'
      ? value
      : stringOrNull(row?.url ?? row?.source)
    if (!source) return []
    const headline = stringOrNull(row?.headline ?? row?.title) ?? `Preview ${index + 1}`
    const label = stringOrNull(row?.accessibilityLabel) ?? `${module.name} preview: ${headline}`
    return [{id: stringOrNull(row?.id) ?? `preview-${index + 1}`, type: 'image' as const, headline, accessibilityLabel: label, source}]
  })
}

function ProductDetailSkeleton({top}: {top: number}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas, paddingHorizontal: spacing[3], paddingTop: top + spacing[2]}]}>
      <ResponsiveContent maxWidth={920}>
        <View accessibilityLabel="Loading product details" style={{gap: spacing[4]}}>
          <View style={{backgroundColor: colours.surface, borderRadius: radius.xlarge, height: 220}} />
          <View style={styles.skeletonLead}>
            <View style={{backgroundColor: colours.surfaceRaised, borderRadius: radius.xlarge, height: 120, width: 120}} />
            <View style={{flex: 1, gap: spacing[2]}}>
              <View style={{backgroundColor: colours.surface, borderRadius: radius.round, height: 20, width: '38%'}} />
              <View style={{backgroundColor: colours.surface, borderRadius: radius.medium, height: 40, width: '72%'}} />
              <View style={{backgroundColor: colours.surface, borderRadius: radius.round, height: 44, width: 112}} />
            </View>
          </View>
          <View style={{backgroundColor: colours.surface, borderRadius: radius.xlarge, height: 92}} />
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  coverRegion: {position: 'relative'},
  editorialBody: {paddingBottom: 20},
  identityCopy: {flex: 1, minWidth: 0},
  identityRow: {alignItems: 'flex-start', flexDirection: 'row'},
  identityStack: {alignItems: 'stretch', flexDirection: 'column'},
  infoRow: {gap: 2},
  informationDetail: {borderWidth: StyleSheet.hairlineWidth, padding: 16},
  productLead: {position: 'relative'},
  relationshipRow: {alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row'},
  screen: {flex: 1},
  skeletonLead: {alignItems: 'center', flexDirection: 'row', gap: 16},
})
