import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useReducer, useState} from 'react'
import {StatusBar} from 'expo-status-bar'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {Surface} from '@/components/primitives/Surface'
import {InstallPreviewSheet} from '@/features/modules/components/InstallPreviewSheet'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleCatalogueCard} from '@/features/modules/components/ModuleCatalogueCard'
import {ModuleInstallProgress} from '@/features/modules/components/ModuleInstallProgress'
import {ModuleStatusPill} from '@/features/modules/components/ModuleStatusPill'
import {ProductHubSearchChrome} from '@/features/modules/components/ProductHubSearchChrome'
import {
  ModuleEditorialHero,
  ModuleRow,
} from '@/features/modules/components/presentation'
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
  ProductNavigationChrome,
  ProductTabs,
  ProductWhatsNew,
  type ProductTabId,
} from '@/features/modules/components/product-detail'
import type {ModuleCatalogueItem, ModuleDetail} from '@/data/repositories/contracts'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {
  initialProductHubSearch,
  reduceProductHubSearch,
} from '@/features/modules/state/productHubSearchMachine'
import {StoryRingAvatar} from '@/platform/ui/avatars/StoryRingAvatar'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaActionButton} from '@/platform/ui/buttons/modula-action-button'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ModulaFieldShell} from '@/platform/ui/controls/modula-field-shell'
import {ModulaOTPField} from '@/platform/ui/controls/modula-otp-field'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaSelectField} from '@/platform/ui/controls/modula-select-field'
import {ModulaSecureField} from '@/platform/ui/controls/modula-secure-field'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ModulaSwitch} from '@/platform/ui/controls/modula-switch'
import {ModulaTagInput} from '@/platform/ui/controls/modula-tag-input'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {ModulaPopover} from '@/platform/ui/menus/modula-popover'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {ModulaActionSheet} from '@/platform/ui/sheets/modula-sheet-compositions'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ProductStatsRow} from '@/platform/ui/chrome/product-stats-row'
import {ModulaPageTabView} from '@/platform/ui/tabs/modula-page-tab-view'
import {ModulaTabs} from '@/platform/ui/tabs/modula-tabs-control'
import {ModulaListRow, ModulaListSection} from '@/platform/ui/lists'
import {ModulaBadge, ModulaProductRow, ModulaUserRow} from '@/platform/ui/identity'
import {ModulaEmptyState, ModulaInlineNotice, ModulaLoadingSection} from '@/platform/ui/feedback'
import {ModulaToolbar} from '@/platform/ui/toolbars'
import {UI_SYSTEM_LAB_MATRIX} from '@/platform/ui/dev/ui-system-lab-matrix'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {
  SettingsDestructiveRow,
  SettingsInfoRow,
  SettingsLinkRow,
  SettingsMenuRow,
  SettingsSection,
  SettingsToggleRow,
} from '@/features/settings/components/SettingsRows'

const SAMPLE_MODULE: ModuleCatalogueItem = {
  moduleId: 'digital.modula.vault-notes',
  name: 'Vault Notes',
  description: 'Private notes and saved knowledge.',
  publisherName: 'Modula',
  publisherId: 'modula',
  kind: 'module',
  category: 'Productivity',
  featured: true,
  installable: true,
  installationState: 'available',
  priceState: 'Free',
  trustLevel: 'firstParty',
  latestVersion: '1.1.0',
  compatibility: 'Compatible',
}

const SAMPLE_MODULE_DETAIL = {
  ...SAMPLE_MODULE,
  longDescription: SAMPLE_MODULE.description,
  backend: {
    mode: 'greenfield-managed',
    provider: 'Modula',
    deploymentOwnership: 'modula-hosted',
    dataLocation: 'greenfield',
    regions: [],
    status: 'available',
    selfHostingSupported: false,
    externalDataProcessing: false,
    backendPermissions: [],
  },
  permissions: [
    {permission: 'records.notes.read', reason: 'Read Vault Notes records.', risk: 'low'},
    {permission: 'records.notes.write', reason: 'Create and update Vault Notes records.', risk: 'low'},
  ],
  contributions: {},
  privacy: 'Vault Notes records are scoped to the current Modula account.',
  releasePublishedAt: '2026-08-01T15:41:25+01:00',
  releaseNotes: [
    'Adds optional, provider-neutral AI product actions with explicit review before changes are applied.',
    'Vault Notes remains operational without AI permissions or provider availability.',
  ],
  sourceRepository: 'modula-mod/modula-vault-notes',
  manifest: {
    compatibility: {platforms: ['ios', 'android', 'web']},
    license: {spdx: 'LicenseRef-Modula-First-Party'},
  },
} as ModuleDetail

/** Focused native specimen for reference-geometry checks on a simulator. */
export function ProductHeroLabScreen({
  initialOverviewOffset = false,
}: {
  initialOverviewOffset?: boolean
} = {}) {
  const insets = useSafeAreaInsets()
  const {width} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const presentation = resolveModuleInstallPresentation(SAMPLE_MODULE)
  const artworkSize = Math.min(116, Math.max(94, Math.round(width * 0.25)))
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)

  return (
    <View style={[styles.heroSpecimen, {backgroundColor: colours.canvas}]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{paddingBottom: spacing[10]}}
        contentOffset={initialOverviewOffset ? {x: 0, y: 780} : undefined}
      >
        <View style={styles.heroSpecimenCover}>
          <ProductCover
            moduleId={SAMPLE_MODULE.moduleId}
            name={SAMPLE_MODULE.name}
            inset={false}
            transitionToCanvas
          />
        </View>
        <View style={[styles.heroSpecimenLead, {gap: spacing[4], paddingHorizontal: spacing[4]}]}>
          <View style={[styles.heroSpecimenIdentity, {gap: spacing[4]}]}>
            <ModuleArtwork
              moduleId={SAMPLE_MODULE.moduleId}
              name={SAMPLE_MODULE.name}
              size={artworkSize}
              variant="hero"
            />
            <View style={{flex: 1, minWidth: 0, paddingTop: spacing[1]}}>
              <ProductIdentity
                name="Vault Notes"
                subtitle="Private notes and knowledge"
                publisher="Modula"
                privateByDesign
                verified
              />
              <View style={{marginTop: spacing[3]}}>
                <ProductActionGroup
                  presentation={presentation}
                  productName="Vault Notes"
                  onPrimary={() => undefined}
                />
              </View>
            </View>
          </View>
          <ProductMetadataStrip
            items={[
              {id: 'rating', value: '—', label: 'Rating'},
              {id: 'age', value: '—', label: 'Age'},
              {id: 'chart', value: '—', label: 'Chart'},
              {id: 'developer', value: 'MODULA', label: 'Developer'},
              {id: 'size', value: '—', label: 'Size'},
              {id: 'version', value: '1.1.0', label: 'Version'},
            ]}
          />
          <ProductTabs selected="overview" onSelect={() => undefined} />
        </View>
        <View style={[styles.heroSpecimenOverview, {gap: spacing[8], paddingHorizontal: spacing[4], paddingTop: spacing[5]}]}>
          <ProductCapabilityStrip
            items={[
              {id: 'privacy', icon: 'privacy', label: 'Private', value: 'Private', detail: 'Account-scoped data'},
              {id: 'offline', icon: 'storage', label: 'Offline', value: 'Not declared', detail: 'No verified offline support'},
              {id: 'sync', icon: 'update', label: 'Sync', value: 'Not declared', detail: 'No verified sync support'},
              {id: 'platforms', icon: 'module', label: 'Platforms', value: 'iOS, Android, Web', detail: 'Registry declaration'},
            ]}
          />
          <ProductWhatsNew
            version="1.1.0"
            releaseDate={SAMPLE_MODULE_DETAIL.releasePublishedAt}
            releaseNotes={SAMPLE_MODULE_DETAIL.releaseNotes ?? []}
            versionHistoryOpen={versionHistoryOpen}
            onVersionHistory={() => setVersionHistoryOpen(current => !current)}
          />
          <ProductPreviewCarousel productName="Vault Notes" frames={[]} />
          <ProductPlatformRow platforms={['ios', 'android', 'web']} />
          <ProductDescription>Keep thoughts, links and information inside your private Vault.</ProductDescription>
          <View style={{gap: spacing[3]}}>
            <AppText variant="headline" accessibilityRole="header">Module Information</AppText>
            <ProductInformationStrip
              items={[
                {id: 'privacy', icon: 'privacy', label: 'Privacy', value: 'Private'},
                {id: 'source', icon: 'verified', label: 'Open Source', value: 'Not declared'},
                {id: 'price', icon: 'marketplace', label: 'In-App Purchases', value: 'Not declared'},
                {id: 'developer', icon: 'profile', label: 'Developer', value: 'Modula'},
              ]}
            />
            <ProductInformationDisclosure label="Information" onPress={() => undefined} />
          </View>
        </View>
      </ScrollView>
      <ProductNavigationChrome
        actions={[{id: 'details', label: 'Product details', icon: 'info'}]}
        moduleId={SAMPLE_MODULE.moduleId}
        onAction={() => undefined}
        onBack={() => undefined}
        onPrimary={() => undefined}
        onShare={() => undefined}
        presentation={presentation}
        productName={SAMPLE_MODULE.name}
        progress={initialOverviewOffset ? 1 : 0}
        top={insets.top + spacing[2]}
      />
    </View>
  )
}

/**
 * State matrix for Modula primitives that flagship screens must prove in 7M-B2.
 */
export function ModulaPrimitivesLabScreen({
  initialInstallReviewOpen = false,
}: {
  initialInstallReviewOpen?: boolean
} = {}) {
  const {colours, spacing, radius} = useThemeTokens()
  const [segment, setSegment] = useState('Following')
  const [secure, setSecure] = useState('secret-value')
  const [otp, setOtp] = useState('')
  const [query, setQuery] = useState('')
  const [fieldValue, setFieldValue] = useState('Ada')
  const [multilineValue, setMultilineValue] = useState('A field that expands with content and system text size.')
  const [selectValue, setSelectValue] = useState<string | undefined>('personal')
  const [tags, setTags] = useState(['modula', 'design'])
  const [enabled, setEnabled] = useState(true)
  const [popover, setPopover] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [actionSheet, setActionSheet] = useState(false)
  const [page, setPage] = useState('overview')
  const [productTab, setProductTab] = useState<ProductTabId>('overview')
  const [installReview, setInstallReview] = useState(initialInstallReviewOpen)
  const [hubSearch, dispatchHubSearch] = useReducer(reduceProductHubSearch, initialProductHubSearch)
  const installPresentation = resolveModuleInstallPresentation(SAMPLE_MODULE)

  return (
    <View style={[styles.content, {gap: spacing[5]}]}>
      <AppText variant="display">Modula UI Lab</AppText>
      <AppText variant="body" colour="textSecondary">
        Typography, surface, icons, and controls in one matrix. Product screens import these wrappers — never SwiftUI directly.
      </AppText>

      <LabBlock title="Acceptance matrix">
        {Object.entries(UI_SYSTEM_LAB_MATRIX).map(([axis, values]) => (
          <View key={axis} style={{gap: spacing[1]}}>
            <AppText variant="label">{axis}</AppText>
            <AppText variant="caption" colour="textSecondary">{values.join(' · ')}</AppText>
          </View>
        ))}
      </LabBlock>

      <LabBlock title="Quality compare">
        <AppText variant="caption" colour="textSecondary">
          OLD / REFERENCE / MODULA NEW. References are linked, not copied, unless licensed.
        </AppText>
        {[
          ['Navigation', 'Rejected 7M-B2 glass-over-feed pill', 'Apple HIG: tabs are destinations', 'NAV-C hybrid: opaque chrome + compose accessory'],
          ['Fields', 'All auth fields as equal blocks', 'iOS AutoFill / progressive identity', 'Email → Continue → password or code'],
          ['Buttons', 'Teal on every action', 'Airbnb scarce accent', 'Primary only on Install / Sign in'],
          ['Menus', 'Custom overflow sheets only', 'SwiftUI Menu / Compose DropdownMenu', 'ModulaMenu + ContextMenu adapters'],
          ['Sheets', 'Card stack install UI', 'Native sheet', 'Install preview sheet + live stages'],
          ['Social', 'Post cards + dashboard banners', 'Threads/X continuous document', 'Hairline rows, Focus Halo stories'],
          ['Marketplace', 'Installed 0 / Available 1 pills', 'App Store editorial shelves', 'Featured / Made by Modula / Your modules'],
          ['Modules', 'Turquoise cube + Permission required', 'App Store identity imagery', 'ModuleArtwork + Available → Install → Open'],
          ['Motion', 'Decorative blur', 'Interruptible toolbar / grid magnification', 'Reaction proximity; no rope physics'],
          ['Media', 'Broken or generic icons', 'expo-image / artwork packs', 'Stories, posts, module art via existing media stack'],
        ].map(([section, old, reference, next]) => (
          <View key={section} style={{gap: 4}}>
            <AppText variant="label">{section}</AppText>
            <AppText variant="caption" colour="textTertiary">OLD · {old}</AppText>
            <AppText variant="caption" colour="textSecondary">REFERENCE · {reference}</AppText>
            <AppText variant="caption">MODULA NEW · {next}</AppText>
          </View>
        ))}
      </LabBlock>

      <LabBlock title="Typography">
        <AppText variant="display">Display</AppText>
        <AppText variant="headline">Headline</AppText>
        <AppText variant="label">Label</AppText>
        <AppText variant="body">Body copy for posts and forms.</AppText>
        <AppText variant="caption" colour="textSecondary">Caption / metadata</AppText>
      </LabBlock>

      <LabBlock title="Surface">
        <Surface variant="contained" style={{padding: spacing[4], borderRadius: radius.large, gap: spacing[2]}}>
          <AppText variant="label">Contained surface</AppText>
          <AppText variant="caption" colour="textSecondary">Canvas {String(colours.canvas)}</AppText>
        </Surface>
      </LabBlock>

      <LabBlock title="Icons">
        <View style={styles.row}>
          <ModulaIcon name="home" colour={colours.accent} />
          <ModulaIcon name="search" colour={colours.accent} />
          <ModulaIcon name="modules" colour={colours.accent} />
          <ModulaIcon name="settings" colour={colours.accent} />
        </View>
      </LabBlock>

      <LabBlock title="Buttons">
        <View style={styles.wrapRow}>
          <ModulaIconButton icon="share" accessibilityLabel="Icon button" chrome="bordered" onPress={() => undefined} />
          <ModulaButton label="Compact" size="compact" role="secondary" onPress={() => undefined} />
          <ModulaButton label="Regular" size="regular" role="secondary" onPress={() => undefined} />
          <ModulaButton label="Primary" size="prominent" onPress={() => undefined} />
          <ModulaButton label="Secondary" role="secondary" onPress={() => undefined} />
          <ModulaButton label="Quiet" role="quiet" onPress={() => undefined} />
          <ModulaButton label="Destructive" role="destructive" onPress={() => undefined} />
          <ModulaButton label="Disabled" disabled onPress={() => undefined} />
          <ModulaButton label="Loading" loading onPress={() => undefined} />
          <ModulaActionButton label="Get" emphasis="primary" onPress={() => undefined} />
          <ModulaActionButton label="Open" onPress={() => undefined} />
        </View>
      </LabBlock>

      <LabBlock title="Semantic lists and rows">
        <ModulaListSection title="Shared rows" footer="Settings and products inherit this geometry.">
          <ModulaListRow title="Navigation" description="Shared list row" variant="navigation" onPress={() => undefined} />
          <ModulaUserRow name="Ada Lovelace" handle="@ada" metadata="Following" />
          <ModulaProductRow name="Vault Notes" subtitle="Private notes" action={{label: 'Open', onPress: () => undefined}} last />
        </ModulaListSection>
      </LabBlock>

      <LabBlock title="Tabs">
        <ModulaTabs
          accessibilityLabel="UI Lab sections"
          onValueChange={setSegment}
          presentation="scrollable"
          tabs={[
            {id: 'Following', label: 'Following'},
            {id: 'For You', label: 'For You'},
            {id: 'Modules', label: 'Modules'},
          ]}
          value={segment}
        />
      </LabBlock>

      <LabBlock title="Toolbar and badges">
        <ModulaToolbar>
          <ModulaIconButton icon="edit" accessibilityLabel="Edit" onPress={() => undefined} />
          <ModulaIconButton icon="share" accessibilityLabel="Share" onPress={() => undefined} />
          <ModulaBadge label="Beta" tone="warning" />
        </ModulaToolbar>
      </LabBlock>

      <LabBlock title="Feedback, loading and empty states">
        <ModulaInlineNotice message="Note saved" tone="success" />
        <ModulaLoadingSection rows={2} />
        <ModulaEmptyState title="Nothing here yet" description="Create an item to get started." />
      </LabBlock>

      <LabBlock title="Toolbar chrome">
        <AppText variant="caption" colour="textSecondary">
          Global back is ModulaBackButton. Painted controls stay compact inside
          44pt targets. Share and overflow have distinct adjacent tap regions.
        </AppText>
        <View style={styles.row}>
          <ModulaBackButton onPress={() => undefined} />
          <ChromeGlassControlGroup
            items={[
              {
                kind: 'button',
                icon: 'share',
                accessibilityLabel: 'Share',
                onPress: () => undefined,
              },
              {
                kind: 'menu',
                accessibilityLabel: 'More actions',
                actions: [
                  {id: 'add', label: 'Add', icon: 'create'},
                  {id: 'save', label: 'Save', icon: 'bookmark'},
                ],
                onAction: () => undefined,
              },
            ]}
          />
        </View>
      </LabBlock>

      <LabBlock title="Product stats">
        <ProductStatsRow
          items={[
            {label: 'Status', value: 'Live', detail: 'In this build'},
            {label: 'Layer', value: 'Shell', detail: 'Capability'},
            {label: 'Includes', value: '4', detail: 'Named surfaces'},
          ]}
        />
      </LabBlock>

      <LabBlock title="Page TabView">
        <AppText variant="caption" colour="textSecondary">
          In-screen pager only. Shell tabs stay on expo-router.
        </AppText>
        <ModulaPageTabView
          selectedId={page}
          onSelect={setPage}
          height={180}
          tabs={[
            {
              id: 'overview',
              title: 'Overview',
              icon: 'info',
              content: (
                <AppText variant="body" colour="textSecondary">
                  Overview page. Native uses SwiftUI TabView page style.
                </AppText>
              ),
            },
            {
              id: 'includes',
              title: 'Includes',
              icon: 'modules',
              content: (
                <AppText variant="body" colour="textSecondary">
                  Includes page. Not a routed bottom tab.
                </AppText>
              ),
            },
          ]}
        />
      </LabBlock>

      <LabBlock title="Fields">
        <ModulaFieldShell label="Text" support="Used on your profile.">
          <ModulaTextInput accessibilityLabel="Text" value={fieldValue} onChangeText={setFieldValue} />
        </ModulaFieldShell>
        <ModulaFieldShell label="Multiline">
          <ModulaTextInput accessibilityLabel="Multiline" multiline value={multilineValue} onChangeText={setMultilineValue} />
        </ModulaFieldShell>
        <ModulaFieldShell label="Select">
          <ModulaSelectField
            accessibilityLabel="Folder"
            value={selectValue}
            onChange={setSelectValue}
            options={[
              {value: 'personal', label: 'Personal'},
              {value: 'work', label: 'Work'},
            ]}
          />
        </ModulaFieldShell>
        <ModulaFieldShell label="Tags">
          <ModulaTagInput value={tags} onChange={setTags} />
        </ModulaFieldShell>
        <ModulaFieldShell label="Search">
          <ModulaSearchField value={query} onChangeText={setQuery} placeholder="Search" />
        </ModulaFieldShell>
        <ModulaFieldShell label="Error" error="A concise field-level error.">
          <ModulaTextInput accessibilityLabel="Error" value="" onChangeText={() => undefined} style={{borderColor: colours.destructive}} />
        </ModulaFieldShell>
        <ModulaFieldShell label="Disabled">
          <ModulaTextInput accessibilityLabel="Disabled" value="Unavailable" editable={false} onChangeText={() => undefined} />
        </ModulaFieldShell>
      </LabBlock>

      <LabBlock title="Settings rows">
        <SettingsSection footer="Grouped rows share one surface and expand with larger text.">
          <SettingsInfoRow icon="account" label="Icon row" value="Value" />
          <SettingsToggleRow label="Switch row" value={enabled} onValueChange={setEnabled} />
          <SettingsLinkRow row={{title: 'Navigation row', value: 'Detail', onPress: () => undefined}} />
          <SettingsMenuRow
            label="Picker row"
            value="System"
            actions={[{id: 'system', label: 'System'}, {id: 'light', label: 'Light'}]}
            onAction={() => undefined}
          />
          <SettingsDestructiveRow label="Destructive row" onPress={() => undefined} last />
        </SettingsSection>
      </LabBlock>

      <LabBlock title="OTP">
        <ModulaOTPField value={otp} onChangeValue={setOtp} />
      </LabBlock>

      <LabBlock title="Search">
        <ModulaSearchField value={query} onChangeText={setQuery} placeholder="Search Modula" />
      </LabBlock>

      <LabBlock title="Secure field">
        <ModulaSecureField value={secure} onChangeText={setSecure} label="Password" />
      </LabBlock>

      <LabBlock title="Segmented control">
        <ModulaSegmentedPicker
          appearance="segmented"
          options={[{value: 'Following', label: 'Following'}, {value: 'For You', label: 'For You'}]}
          value={segment}
          onValueChange={setSegment}
        />
      </LabBlock>

      <LabBlock title="Switch">
        <ModulaSwitch value={enabled} onValueChange={setEnabled} accessibilityLabel="Enabled" />
      </LabBlock>

      <LabBlock title="Sheet">
        <ModulaButton label="Show sheet" role="secondary" onPress={() => setSheet(true)} />
        <ModulaButton label="Show action sheet" role="secondary" onPress={() => setActionSheet(true)} />
        <ModulaSheet isPresented={sheet} onDismiss={() => setSheet(false)} presentation="interactive" title="Sheet">
          <AppText variant="body" colour="textSecondary">Install review and overflow actions use this adapter.</AppText>
        </ModulaSheet>
        <ModulaActionSheet
          actions={[
            {id: 'share', label: 'Share', icon: 'share'},
            {id: 'save', label: 'Save', icon: 'bookmark'},
            {id: 'report', label: 'Report', icon: 'warning', style: 'destructive'},
          ]}
          isPresented={actionSheet}
          onAction={() => undefined}
          onDismiss={() => setActionSheet(false)}
          title="Actions"
        />
      </LabBlock>

      <LabBlock title="Popover">
        <ModulaPopover
          isOpen={popover}
          onDismiss={() => setPopover(false)}
          trigger={<ModulaButton label={popover ? 'Hide popover' : 'Show popover'} role="secondary" onPress={() => setPopover(open => !open)} />}>
          <AppText variant="body">Popover sample.</AppText>
        </ModulaPopover>
      </LabBlock>

      <LabBlock title="Context menu">
        <ModulaContextMenu
          accessibilityLabel="Sample context menu"
          title="Actions"
          actions={[
            {id: 'share', label: 'Share', icon: 'share'},
            {
              id: 'mute',
              label: 'Mute',
              icon: 'notifications',
              children: [
                {id: 'mute-8h', label: '8 hours'},
                {id: 'mute-1w', label: '1 week'},
              ],
            },
            {
              id: 'open-tab',
              label: 'Open tab',
              icon: 'board',
              picker: {
                options: [
                  {id: 'posts', label: 'Posts'},
                  {id: 'media', label: 'Media'},
                ],
                selectedId: 'posts',
              },
            },
            {id: 'delete', label: 'Delete', icon: 'trash', style: 'destructive'},
          ]}
          onAction={() => undefined}>
          <AppText variant="body">
            Long-press for nested Mute, a tab picker, and Delete.
          </AppText>
        </ModulaContextMenu>
      </LabBlock>

      <LabBlock title="Drawer">
        <AppText variant="body" colour="textSecondary">
          Navigation drawer is the existing shell adapter (`NavigationDrawer` + `ShellDrawerContext`). Do not add a second drawer primitive.
        </AppText>
      </LabBlock>

      <LabBlock title="Avatar">
        <Avatar name="Modula" colour="#369CAA" size={44} />
      </LabBlock>

      <LabBlock title="Story Ring">
        <View style={styles.row}>
          <StoryRingAvatar name="You" colour="#369CAA" size={56} />
          <StoryRingAvatar name="Ada" colour="#369CAA" size={56} seen />
        </View>
      </LabBlock>

      <LabBlock title="Post Card">
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          <Avatar name="Modula" colour="#369CAA" size={36} />
          <View style={{flex: 1, gap: 2}}>
            <AppText variant="label">Modula</AppText>
            <AppText variant="body">Content dominates chrome. Posts are a stream, not dashboard cards.</AppText>
          </View>
        </View>
      </LabBlock>

      <LabBlock title="Reaction Picker">
        <View style={styles.row}>
          {['👍', '❤️', '😂', '🔥'].map(emoji => (
            <AppText key={emoji} variant="title">{emoji}</AppText>
          ))}
        </View>
        <AppText variant="caption" colour="textSecondary">
          Tap Like. Long-press for proximity row. Web/screen reader uses a standard menu.
        </AppText>
      </LabBlock>

      <LabBlock title="Comment Thread">
        <View style={{gap: spacing[2], paddingLeft: spacing[2]}}>
          <AppText variant="label">Ada</AppText>
          <AppText variant="body">Comment affordance opens the post thread, not a dashboard card.</AppText>
          <AppText variant="caption" colour="textSecondary">Reply · 2m</AppText>
        </View>
      </LabBlock>

      <LabBlock title="Module Card">
        <ModuleCatalogueCard item={SAMPLE_MODULE} onPress={() => undefined} />
      </LabBlock>

      <LabBlock title="Install Button">
        <ModulaButton label="Install" accessibilityLabel="Install Vault Notes" onPress={() => undefined} />
      </LabBlock>

      <LabBlock title="Install Progress">
        <ModuleInstallProgress productName="Vault Notes" stage="compatibility" />
      </LabBlock>

      <LabBlock title="Permissions">
        <AppText variant="body" colour="textSecondary">• Store Vault Notes records</AppText>
        <AppText variant="body" colour="textSecondary">• Read its own records</AppText>
        <AppText variant="body" colour="textSecondary">• Search its own records</AppText>
      </LabBlock>

      <LabBlock title="Module Status">
        <View style={styles.row}>
          <ModuleStatusPill state="available" />
          <ModuleStatusPill state="enabled" />
          <ModuleStatusPill state="updateAvailable" />
        </View>
      </LabBlock>

      <LabBlock title="ProductCover">
        <ProductCover moduleId={SAMPLE_MODULE.moduleId} name={SAMPLE_MODULE.name} />
      </LabBlock>

      <LabBlock title="ProductNavigationChrome">
        <View style={styles.chromePreview}>
          <ProductCover moduleId={SAMPLE_MODULE.moduleId} name={SAMPLE_MODULE.name} />
          <ProductNavigationChrome
            productName={SAMPLE_MODULE.name}
            top={12}
            onBack={() => undefined}
            onPrimary={() => setInstallReview(true)}
            onShare={() => undefined}
            presentation={installPresentation}
            actions={[{id: 'details', label: 'Product details', icon: 'info'}]}
            onAction={() => undefined}
          />
        </View>
      </LabBlock>

      <LabBlock title="ModuleArtwork">
        <View style={styles.row}>
          <ModuleArtwork moduleId={SAMPLE_MODULE.moduleId} name={SAMPLE_MODULE.name} size={96} variant="hero" />
          <ModuleArtwork moduleId={SAMPLE_MODULE.moduleId} name={SAMPLE_MODULE.name} variant="row" />
          <ModuleArtwork moduleId={SAMPLE_MODULE.moduleId} name={SAMPLE_MODULE.name} variant="compact" />
        </View>
      </LabBlock>

      <LabBlock title="ProductIdentity">
        <ProductIdentity
          name="Vault Notes"
          subtitle="Private notes and knowledge"
          publisher="Modula"
          privateByDesign
          verified
        />
      </LabBlock>

      <LabBlock title="ProductActions">
        <ProductActionGroup
          presentation={installPresentation}
          productName="Vault Notes"
          onPrimary={() => setInstallReview(true)}
        />
      </LabBlock>

      <LabBlock title="ProductMetadataStrip">
        <ProductMetadataStrip
          items={[
            {id: 'privacy', value: 'PRIVATE', label: 'Privacy', detail: 'Account scoped'},
            {id: 'version', value: '1.1.0', label: 'Version'},
            {id: 'developer', value: 'MODULA', label: 'Developer'},
            {id: 'source', value: 'VERIFIED', label: 'Source'},
          ]}
        />
      </LabBlock>

      <LabBlock title="ProductTabs">
        <ProductTabs selected={productTab} onSelect={setProductTab} />
      </LabBlock>

      <LabBlock title="ProductCapabilityStrip">
        <ProductCapabilityStrip
          items={[
            {id: 'privacy', icon: 'privacy', label: 'Privacy', value: 'Private', detail: 'Account-scoped records'},
            {id: 'records', icon: 'note', label: 'Records', value: 'Notes & folders', detail: 'Declared storage'},
            {id: 'source', icon: 'verified', label: 'Source', value: 'Verified', detail: 'Published by Modula'},
          ]}
        />
      </LabBlock>

      <LabBlock title="ProductPreviewCarousel">
        <ProductPreviewCarousel productName="Vault Notes" frames={[]} />
        <AppText variant="caption" colour="textSecondary">
          Intentionally empty until verified running-module screenshots are captured.
        </AppText>
      </LabBlock>

      <LabBlock title="ProductNavigationChrome · collapsed">
        <View style={styles.stickyPreview}>
          <ProductNavigationChrome
            actions={[{id: 'details', label: 'Product details', icon: 'info'}]}
            onAction={() => undefined}
            onBack={() => undefined}
            onPrimary={() => setInstallReview(true)}
            onShare={() => undefined}
            top={0}
            moduleId={SAMPLE_MODULE.moduleId}
            productName={SAMPLE_MODULE.name}
            progress={1}
            presentation={installPresentation}
          />
        </View>
      </LabBlock>

      <LabBlock title="InstallReview">
        <ModulaButton label="Review Vault Notes install" onPress={() => setInstallReview(true)} />
      </LabBlock>

      <LabBlock title="ModuleRow">
        <ModuleRow item={SAMPLE_MODULE} onPress={() => undefined} onAction={() => setInstallReview(true)} />
      </LabBlock>

      <LabBlock title="EditorialHero">
        <ModuleEditorialHero item={SAMPLE_MODULE} onPress={() => undefined} onAction={() => setInstallReview(true)} />
      </LabBlock>

      <LabBlock title="ProductHubSearch">
        <ProductHubSearchChrome
          model={hubSearch}
          compact={false}
          onTrigger={() => dispatchHubSearch({type: 'TAP_SEARCH'})}
          onChangeText={query => dispatchHubSearch({type: 'TYPE', query})}
          onCancel={() => dispatchHubSearch({type: 'CANCEL'})}
          onSettled={() => {
            if (hubSearch.state === 'SEARCH_EXPANDING') dispatchHubSearch({type: 'GEOMETRY_SETTLED'})
            if (hubSearch.state === 'SEARCH_COLLAPSING') dispatchHubSearch({type: 'COLLAPSE_COMPLETE'})
          }}
        />
      </LabBlock>

      <InstallPreviewSheet
        module={SAMPLE_MODULE_DETAIL}
        preview={null}
        isPresented={installReview}
        pending={false}
        onDismiss={() => setInstallReview(false)}
        onInstall={() => undefined}
        onInstallAndEnable={() => undefined}
      />
    </View>
  )
}

function LabBlock({title, children}: {title: string; children: React.ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}} testID={`ui-lab-${title.toLowerCase().split(' ')[0]}`}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  chromePreview: {overflow: 'hidden', position: 'relative'},
  content: {paddingBottom: 48},
  heroSpecimen: {flex: 1},
  heroSpecimenCover: {position: 'relative'},
  heroSpecimenIdentity: {alignItems: 'flex-start', flexDirection: 'row'},
  heroSpecimenLead: {marginTop: -64},
  heroSpecimenOverview: {paddingBottom: 20},
  row: {flexDirection: 'row', gap: 16},
  stickyPreview: {height: 72, position: 'relative'},
  wrapRow: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8},
})
