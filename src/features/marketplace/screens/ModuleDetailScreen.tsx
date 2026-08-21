import {useEffect, useState} from 'react'
import {Alert, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import {StatusBar} from 'expo-status-bar'
import {useQueryClient} from '@tanstack/react-query'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import type {ModuleDetail, ModuleInstallPreview} from '@/data/repositories/contracts'
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
  ProductStickyHeader,
  ProductTabs,
  ProductTopChrome,
  ProductWhatsNew,
  type ProductCapabilityItem,
  type ProductInformationItem,
  type ProductMetadataItem,
  type ProductPreviewFrame,
  type ProductTabId,
} from '@/features/modules/components/product-detail'
import {isInstalledModuleState, resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {presentPermissions} from '@/features/modules/identity/permissionPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useModuleDetailQuery} from '@/features/modules/hooks'
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
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const {width} = useWindowDimensions()
  const {colours, scheme, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const detail = useModuleDetailQuery(id)
  const module = detail.data
  const [preview, setPreview] = useState<ModuleInstallPreview | null>(null)
  const [installSheetOpen, setInstallSheetOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [installStage, setInstallStage] = useState<ModuleInstallStageId | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<ProductTabId>('overview')
  const [informationOpen, setInformationOpen] = useState<string | null>(null)
  const [heroActionBottom, setHeroActionBottom] = useState(360)
  const [scrollOffset, setScrollOffset] = useState(0)

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
      .installPreview(module.moduleId, module.latestVersion ?? undefined)
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
      const nextPreview = preview ?? await services.moduleRepository.installPreview(module.moduleId, module.latestVersion ?? undefined)
      setPreview(nextPreview)
      setInstallStage('compatibility')
      if (nextPreview.compatible === false) {
        throw new Error(nextPreview.incompatibilityReasons.join(', ') || 'This module is not compatible.')
      }
      setInstallStage('installing')
      await services.moduleRepository.install(module.moduleId, {version: module.latestVersion ?? undefined})
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
      const confirmed = await confirmModulaAction({
        title: `Uninstall ${module.name}?`,
        message: 'This keeps your module data for a future reinstall.',
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
      console.warn('Product Hub module action failed', error)
      Alert.alert(`${module.name} couldn’t be updated`, 'Try again.')
    } finally {
      setBusy(null)
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
  const metadata = metadataFor(module, platforms)
  const capabilities = capabilitiesFor(module, platforms)
  const information = informationFor(module)
  const permissionGroups = presentPermissions(module.permissions, copy.name).groups
  const previewFrames = previewsFor(module.moduleId)
  const stackedIdentity = width < 330
  const heroArtworkSize = Math.min(116, Math.max(94, Math.round(width * 0.25)))
  const stickyVisible = scrollOffset > heroActionBottom

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
      <StatusBar style={scrollOffset < 210 ? 'light' : scheme === 'dark' ? 'light' : 'dark'} />
      <ResponsiveContent maxWidth={920}>
        <ScrollView
          contentContainerStyle={{paddingBottom: tabPadding + spacing[8]}}
          keyboardShouldPersistTaps="handled"
          onScroll={event => setScrollOffset(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}>
          <View style={styles.coverRegion}>
            <ProductCover
              moduleId={module.moduleId}
              name={copy.name}
              inset={false}
              transitionToCanvas
            />
            <ProductTopChrome
              productName={copy.name}
              top={insets.top + spacing[2]}
              onBack={goBack}
              onShare={shareModule}
              actions={overflowActions}
              onAction={onOverflow}
            />
          </View>

          <View
            style={[
              styles.productLead,
              {gap: spacing[4], marginTop: -64, paddingHorizontal: spacing[4]},
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
                  style={{marginTop: spacing[3]}}
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
              {gap: spacing[8], paddingHorizontal: spacing[4], paddingTop: spacing[5]},
            ]}>
            <TabContent
              tab={selectedTab}
              module={module}
              productName={copy.name}
              description={copy.whatItDoes}
              capabilities={capabilities}
              platforms={platforms}
              releaseNotes={releaseNotes}
              previewFrames={previewFrames}
              information={information}
              informationOpen={informationOpen}
              onInformation={id => setInformationOpen(current => current === id ? null : id)}
              permissionGroups={permissionGroups}
              onProductHub={() => router.push('/product' as Href)}
            />
          </View>
        </ScrollView>
      </ResponsiveContent>

      <ProductStickyHeader
        visible={stickyVisible}
        top={insets.top + spacing[1]}
        moduleId={module.moduleId}
        name={copy.name}
        presentation={presentation}
        onPrimary={onPrimary}
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

function TabContent({
  tab,
  module,
  productName,
  description,
  capabilities,
  platforms,
  releaseNotes,
  previewFrames,
  information,
  informationOpen,
  onInformation,
  permissionGroups,
  onProductHub,
}: {
  tab: ProductTabId
  module: ModuleDetail
  productName: string
  description: string
  capabilities: ProductCapabilityItem[]
  platforms: string[]
  releaseNotes: string[]
  previewFrames: ProductPreviewFrame[]
  information: ProductInformationItem[]
  informationOpen: string | null
  onInformation: (id: string) => void
  permissionGroups: ReturnType<typeof presentPermissions>['groups']
  onProductHub: () => void
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

  if (tab === 'versions') {
    return <ProductWhatsNew version={module.latestVersion} releaseNotes={releaseNotes} />
  }

  if (tab === 'related') {
    return (
      <View style={{gap: spacing[3]}}>
        <AppText variant="headline" accessibilityRole="header">Made by {module.publisherName}</AppText>
        <AppText variant="body" colour="textSecondary">Discover more products from this publisher in Product Hub.</AppText>
        <ModulaButton label="Explore Product Hub" role="secondary" onPress={onProductHub} />
      </View>
    )
  }

  return (
    <>
      <ProductCapabilityStrip items={capabilities} />
      <ProductWhatsNew version={module.latestVersion} releaseNotes={releaseNotes} />
      <ProductPreviewCarousel productName={productName} frames={previewFrames} />
      <ProductPlatformRow platforms={platforms} />
      <ProductDescription>{description}</ProductDescription>
      <View style={{gap: spacing[3]}}>
        <ProductInformationStrip items={information.map(item => ({...item, onPress: () => onInformation(item.id)}))} />
        {informationOpen ? <InformationDetail module={module} section={informationOpen} /> : null}
        <ProductInformationDisclosure label="Information" onPress={() => onInformation(informationOpen ?? 'privacy')} />
      </View>
    </>
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
          <InfoRow label="Canonical repository" value={vault ? VAULT_NOTES_CANONICAL_SOURCE : module.sourceRepository || 'Not declared'} />
          <InfoRow label="Registry release" value={module.latestVersion ?? 'Not published'} />
          {vault ? <InfoRow label="Canonical source release" value={CANONICAL_VAULT_NOTES_CURRENT_VERSION} /> : null}
          <InfoRow label="Registry source" value={module.sourceRepository || 'Not declared'} />
          <InfoRow label="Commit" value={module.sourceCommit || 'Not declared'} />
        </>
      ) : null}
      {section === 'price' ? (
        <>
          <AppText variant="label">Price</AppText>
          <AppText variant="body" colour="textSecondary">
            This registry release is listed as {module.priceState.toLowerCase()}.
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

function metadataFor(module: ModuleDetail, platforms: string[]): ProductMetadataItem[] {
  const items: ProductMetadataItem[] = []
  const privateRecords = Boolean(module.privacy) || module.permissions.some(permission => /record|note|folder/i.test(permission.permission))
  if (privateRecords) items.push({id: 'privacy', value: 'PRIVATE', label: 'Privacy', detail: 'Account scoped'})
  if (module.latestVersion) items.push({id: 'version', value: module.latestVersion, label: 'Version', detail: 'Registry release'})
  items.push({id: 'developer', value: module.publisherName.toUpperCase(), label: 'Developer'})
  if (module.trustLevel === 'firstParty') items.push({id: 'source', value: 'VERIFIED', label: 'Source', detail: 'First party'})
  if (platforms.length) {
    items.push({
      id: 'platform',
      value: platforms.length >= 3 ? 'UNIVERSAL' : String(platforms.length),
      label: 'Platform',
      detail: platforms.map(platformLabel).join(' · '),
    })
  }
  return items
}

function capabilitiesFor(module: ModuleDetail, platforms: string[]): ProductCapabilityItem[] {
  const items: ProductCapabilityItem[] = []
  if (module.privacy || module.permissions.some(permission => /record|note|folder/i.test(permission.permission))) {
    items.push({id: 'privacy', icon: 'privacy', label: 'Privacy', value: 'Private', detail: 'Account-scoped records'})
  }
  if (module.permissions.some(permission => /record|note|folder/i.test(permission.permission))) {
    items.push({id: 'records', icon: 'note', label: 'Records', value: 'Notes & folders', detail: 'Declared module storage'})
  }
  if (module.trustLevel === 'firstParty') {
    items.push({id: 'source', icon: 'verified', label: 'Source', value: 'Verified', detail: 'Published by Modula'})
  }
  if (platforms.length) {
    items.push({id: 'platforms', icon: 'module', label: 'Platforms', value: platforms.map(platformLabel).join(', '), detail: module.compatibility})
  }
  return items
}

function informationFor(module: ModuleDetail): ProductInformationItem[] {
  const items: ProductInformationItem[] = []
  if (module.privacy || module.permissions.length) items.push({id: 'privacy', icon: 'privacy', label: 'Privacy', value: 'Private'})
  if (module.sourceRepository || module.trustLevel === 'firstParty') items.push({id: 'source', icon: 'verified', label: 'Source', value: module.trustLevel === 'firstParty' ? 'Verified' : 'Declared'})
  if (module.priceState === 'Free' || module.priceState === 'Included') items.push({id: 'price', icon: 'marketplace', label: 'Price', value: module.priceState})
  items.push({id: 'developer', icon: 'profile', label: 'Developer', value: module.publisherName})
  return items
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

function previewsFor(_moduleId: string): ProductPreviewFrame[] {
  // B9 only exposes captures produced by the running module. Verified media is
  // added by the evidence capture step; illustrative UI mocks are forbidden.
  return []
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
  screen: {flex: 1},
  skeletonLead: {alignItems: 'center', flexDirection: 'row', gap: 16},
})
