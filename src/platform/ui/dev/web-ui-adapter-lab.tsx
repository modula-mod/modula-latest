import {useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useHydrated} from '@/lib/useHydrated'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaButtonGroup} from '@/platform/ui/buttons/modula-button-group'
import {ModulaCommand} from '@/platform/ui/command/modula-command'
import {useModulaCommandShortcut} from '@/platform/ui/command/use-modula-command-shortcut'
import {ModulaCombobox} from '@/platform/ui/controls/modula-combobox'
import {ModulaCheckbox} from '@/platform/ui/controls/modula-checkbox'
import {ModulaChip} from '@/platform/ui/controls/modula-chip'
import {ModulaProgress} from '@/platform/ui/controls/modula-progress'
import {ModulaRadioGroup} from '@/platform/ui/controls/modula-radio-group'
import {ModulaRange} from '@/platform/ui/controls/modula-range'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ModulaSelectField} from '@/platform/ui/controls/modula-select-field'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {ModulaStepper} from '@/platform/ui/controls/modula-stepper'
import {ModulaSwitch} from '@/platform/ui/controls/modula-switch'
import {ModulaToggleGroup} from '@/platform/ui/controls/modula-toggle-group'
import {ModulaList, ModulaListItem} from '@/platform/ui/controls/modula-list'
import {ModulaDialog, type ModulaDialogSize} from '@/platform/ui/dialogs'
import {
  ModulaDrawer,
  ModulaDrawerNavigator,
  type ModulaDrawerPresentation,
  type ModulaDrawerScreen,
} from '@/platform/ui/drawers'
import {ModulaNotification, ModulaTooltip, useModulaToast} from '@/platform/ui/feedback'
import {ModulaFloatingButton, ModulaFloatingGroup} from '@/platform/ui/floating'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaPopover} from '@/platform/ui/menus/modula-popover'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {ModulaListRow, ModulaListSection} from '@/platform/ui/lists'
import {ModulaBreadcrumbs} from '@/platform/ui/navigation/modula-breadcrumbs'
import {ModulaNavigationMenu} from '@/platform/ui/navigation/modula-navigation-menu'
import {ModulaDataTable} from '@/platform/ui/data/modula-data-table'
import {ModulaEdgeSheet} from '@/platform/ui/sheets/modula-edge-sheet'
import type {ModulaSheetDirection} from '@/platform/ui/sheets/modula-sheet.types'
import {ModulaTabs} from '@/platform/ui/tabs/modula-tabs-control'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'

type DrawerSpecimen =
  | 'content'
  | 'medium'
  | 'tools'
  | 'drill-in'
  | 'true-nested'
  | 'input'
  | 'long'
  | 'filters'
  | 'action-drawer'
  | 'picker-drawer'

const DRAWER_SPECIMENS: {id: DrawerSpecimen; label: string}[] = [
  {id: 'content', label: 'Content'},
  {id: 'medium', label: 'Medium'},
  {id: 'tools', label: 'Large / tools'},
  {id: 'drill-in', label: 'Drill-in navigation'},
  {id: 'true-nested', label: 'True nested modal'},
  {id: 'input', label: 'Input / keyboard'},
  {id: 'long', label: 'Long scroll'},
  {id: 'filters', label: 'Filters'},
  {id: 'action-drawer', label: 'Action drawer'},
  {id: 'picker-drawer', label: 'Picker drawer'},
]

const TOOL_ACTIONS = ['Photo', 'Camera', 'Poll', 'File', 'Voice', 'AI']

/** Development-only interaction matrix. Every specimen consumes Modula APIs. */
export function WebUiAdapterLab() {
  const {spacing} = useThemeTokens()
  const {preferences} = useAppearance()
  const appearance = useAppearanceActions()
  const toast = useModulaToast()
  const [drawer, setDrawer] = useState<DrawerSpecimen | null>(null)
  const [nestedModal, setNestedModal] = useState(false)
  const [sheet, setSheet] = useState<ModulaSheetDirection | null>(null)
  const [dialog, setDialog] = useState<ModulaDialogSize | null>(null)
  const [menuChecked, setMenuChecked] = useState(true)
  const [menuRadio, setMenuRadio] = useState('regular')
  const [popover, setPopover] = useState(false)
  const [command, setCommand] = useState(false)
  const [select, setSelect] = useState<string | undefined>('system')
  const [combo, setCombo] = useState<string | undefined>()
  const [tab, setTab] = useState('drawer')
  const [toggles, setToggles] = useState(['bold'])
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState(true)
  const [switched, setSwitched] = useState(true)
  const [choice, setChoice] = useState('weekly')
  const [range, setRange] = useState(42)
  const [stepper, setStepper] = useState(3)
  const [chip, setChip] = useState('installed')
  const [notificationVisible, setNotificationVisible] = useState(true)
  const [draft, setDraft] = useState('An unsaved Vault Notes draft')
  const [savedDraft, setSavedDraft] = useState('')
  const [saveCount, setSaveCount] = useState(0)
  const [font, setFont] = useState('System')
  const [fontQuery, setFontQuery] = useState('')
  const hydrated = useHydrated()
  useModulaCommandShortcut(() => setCommand(true))
  const commandActions = useMemo(() => [
    {id: 'new-note', label: 'Create note', description: 'Create a real local draft', icon: 'create' as const, onSelect: () => toast.show({message: 'Draft action selected', tone: 'info'})},
    {id: 'open-tools', label: 'Open tools', description: 'Show registered composer tools', icon: 'modules' as const, onSelect: () => setDrawer('tools')},
    {id: 'settings', label: 'Open settings', description: 'Navigate through the owning route', icon: 'settings' as const, onSelect: () => toast.show({message: 'Navigation action selected', tone: 'info'})},
  ], [toast])

  const presentation: ModulaDrawerPresentation = drawer === 'filters'
    ? 'filters'
    : drawer === 'picker-drawer'
      ? 'picker'
      : drawer === 'tools' || drawer === 'long' || drawer === 'input' || drawer === 'true-nested'
        ? 'tools'
        : 'actions'
  const detents = drawer === 'content' || drawer === 'action-drawer'
    ? (['content'] as const)
    : drawer === 'medium' || drawer === 'picker-drawer'
      ? (['content', 'medium'] as const)
      : (['medium', 'large', 'full'] as const)
  const drawerScreens = useMemo(
    () => createDrawerNavigationScreens(font, setFont, fontQuery, setFontQuery),
    [font, fontQuery],
  )

  return (
    <View
      style={[styles.root, {gap: spacing[5]}]}
      testID={hydrated ? 'web-ui-adapter-lab' : 'web-ui-adapter-lab-loading'}>
      <View style={{gap: spacing[1]}}>
        <AppText variant="display">Web Adapter V1</AppText>
        <AppText variant="body" colour="textSecondary">
          Responsive Drawer, Sheet, Dialog, Menu, Popover, Command, form, button, tab, and feedback adapters.
        </AppText>
      </View>

      <LabSection title="Drawer matrix">
        <View style={styles.wrap}>
          {DRAWER_SPECIMENS.map(specimen => (
            <ModulaButton
              key={specimen.id}
              label={specimen.label}
              onPress={() => setDrawer(specimen.id)}
              role="secondary"
              size="compact"
              testID={`web-adapter-drawer-${specimen.id}`}
            />
          ))}
        </View>
      </LabSection>

      <LabSection title="Appearance evidence">
        <ModulaSegmentedPicker
          accessibilityLabel="Web presentation"
          appearance="segmented"
          options={[
            {value: 'liquid', label: 'Liquid'},
            {value: 'material', label: 'Material'},
          ]}
          testID="web-adapter-presentation"
          value={preferences.webPresentation}
          onValueChange={value => {
            if (value === 'liquid' || value === 'material') appearance.setWebPresentation(value)
          }}
        />
        <View style={styles.wrap}>
          <ModulaButton label="Preview light" onPress={() => appearance.setMode('light')} role="secondary" size="compact" testID="web-adapter-theme-light" />
          <ModulaButton label="Preview dark" onPress={() => appearance.setMode('dark')} role="secondary" size="compact" testID="web-adapter-theme-dark" />
          <ModulaButton label="Preview OLED" onPress={() => appearance.setMode('oled')} role="secondary" size="compact" testID="web-adapter-theme-oled" />
          <ModulaButton label="Teal accent" onPress={() => appearance.setAccent('modulaTeal')} role="secondary" size="compact" testID="web-adapter-accent-teal" />
          <ModulaButton label="Violet accent" onPress={() => appearance.setAccent('vividViolet')} role="secondary" size="compact" testID="web-adapter-accent-violet" />
          <ModulaButton label="Reduce motion" onPress={() => appearance.setReduceMotion('on')} role="secondary" size="compact" testID="web-adapter-reduce-motion" />
          <ModulaButton label="Reduce transparency" onPress={() => appearance.setReduceTransparency('on')} role="secondary" size="compact" testID="web-adapter-reduce-transparency" />
          <ModulaButton label="Increase contrast" onPress={() => appearance.setIncreaseContrast('on')} role="secondary" size="compact" testID="web-adapter-increase-contrast" />
        </View>
      </LabSection>

      <LabSection title="Surface presentation">
        <View style={styles.surfaceGrid}>
          <Surface variant="platform" style={styles.surfaceSpecimen}>
            <AppText variant="label">Platform surface</AppText>
            <AppText variant="caption" colour="textSecondary">Liquid translucency or Material elevation.</AppText>
          </Surface>
          <Surface variant="solid" style={styles.surfaceSpecimen}>
            <AppText variant="label">Explicit solid</AppText>
            <AppText variant="caption" colour="textSecondary">Remains solid in both presentations.</AppText>
          </Surface>
          <Surface variant="glass" style={styles.surfaceSpecimen}>
            <AppText variant="label">Explicit glass</AppText>
            <AppText variant="caption" colour="textSecondary">A deliberate Modula surface request.</AppText>
          </Surface>
        </View>
        <ModulaFloatingGroup>
          <ModulaFloatingButton icon="edit" label="Edit preview" onPress={() => toast.show({message: 'Edit selected', tone: 'info'})} />
          <ModulaFloatingButton icon="share" label="Share preview" onPress={() => toast.show({message: 'Share selected', tone: 'info'})} />
        </ModulaFloatingGroup>
      </LabSection>

      <LabSection title="Navigation primitives">
        <ModulaBreadcrumbs
          items={[
            {id: 'hub', label: 'Product Hub', onPress: () => toast.show({message: 'Product Hub selected', tone: 'info'})},
            {id: 'productivity', label: 'Productivity', onPress: () => toast.show({message: 'Productivity selected', tone: 'info'})},
            {id: 'vault', label: 'Vault Notes'},
          ]}
          testID="web-adapter-breadcrumbs"
        />
        <ModulaNavigationMenu
          accessibilityLabel="UI Lab navigation"
          items={[
            {id: 'home', label: 'Home', active: true, onPress: () => toast.show({message: 'Home selected', tone: 'info'})},
            {id: 'hub', label: 'Product Hub', onPress: () => toast.show({message: 'Product Hub selected', tone: 'info'})},
            {id: 'modules', label: 'Modules', onPress: () => toast.show({message: 'Modules selected', tone: 'info'})},
            {id: 'disabled', label: 'Unavailable', disabled: true, onPress: () => undefined},
          ]}
          testID="web-adapter-navigation-menu"
        />
      </LabSection>

      <LabSection title="Sheet matrix">
        <View style={styles.wrap}>
          {(['left', 'right', 'bottom'] as const).map(direction => (
            <ModulaButton key={direction} label={direction} onPress={() => setSheet(direction)} role="secondary" size="compact" />
          ))}
        </View>
      </LabSection>

      <LabSection title="Dialog matrix">
        <View style={styles.wrap}>
          {(['small', 'regular', 'large'] as const).map(size => (
            <ModulaButton key={size} label={size} onPress={() => setDialog(size)} role="secondary" size="compact" />
          ))}
        </View>
      </LabSection>

      <LabSection title="Navigation chrome">
        <View style={styles.wrap}>
          <ModulaBackButton
            accessibilityLabel="Preview back control"
            onPress={() => toast.show({message: 'Back control selected', tone: 'info'})}
          />
          <ChromeGlassControlGroup
            items={[{
              kind: 'menu',
              icon: 'more',
              accessibilityLabel: 'Preview more options',
              title: 'Preview actions',
              actions: [{id: 'inspect', label: 'Inspect action'}],
              onAction: id => toast.show({message: `${id} selected`, tone: 'info'}),
            }]}
          />
        </View>
      </LabSection>

      <LabSection title="Menu and popover">
        <View style={styles.wrap}>
          <ModulaMenu
            accessibilityLabel="Open adapter menu"
            actions={[
              {id: 'copy', label: 'Copy link', icon: 'share'},
              {id: 'notifications', label: 'Notifications', icon: 'notifications', checked: menuChecked},
              {id: 'density', label: 'Density', picker: {selectedId: menuRadio, options: [{id: 'compact', label: 'Compact'}, {id: 'regular', label: 'Regular'}]}},
              {id: 'share', label: 'Share', children: [{id: 'share-copy', label: 'Copy'}, {id: 'share-system', label: 'System share'}]},
              {id: 'delete', label: 'Delete', icon: 'trash', style: 'destructive'},
            ]}
            onAction={id => {
              if (id === 'notifications') setMenuChecked(value => !value)
              if (id === 'compact' || id === 'regular') setMenuRadio(id)
              if (id === 'delete') {
                void confirmModulaAction({
                  title: 'Delete example?',
                  message: 'This verifies that a menu can hand off safely to a confirmation dialog.',
                  confirmLabel: 'Delete',
                }).then(confirmed => {
                  toast.show({message: confirmed ? 'Delete action confirmed' : 'Delete action cancelled', tone: 'info'})
                })
                return
              }
              toast.show({message: `${id} action selected`, tone: 'info'})
            }}
            title="Module actions"
            trigger={<AppText variant="buttonLabel">Open menu</AppText>}
          />
          <ModulaPopover
            accessibilityLabel="Quick options"
            isOpen={popover}
            onDismiss={() => setPopover(false)}
            onOpen={() => setPopover(true)}
            trigger={<AppText variant="buttonLabel">Quick options</AppText>}>
            <View style={{gap: spacing[2]}}>
              <AppText variant="label">Quick options</AppText>
              <AppText variant="caption" colour="textSecondary">Anchored on desktop, touch-safe through the semantic API.</AppText>
              <PresentationSpecimenControls />
            </View>
          </ModulaPopover>
          <ModulaContextMenu
            accessibilityLabel="Adapter context target"
            actions={[{id: 'copy-context', label: 'Copy context'}, {id: 'remove-context', label: 'Remove', style: 'destructive'}]}
            onAction={id => toast.show({message: `${id} selected`, tone: 'info'})}
            title="Context actions">
            <View style={styles.contextTarget} testID="web-adapter-context-target">
              <AppText variant="buttonLabel">Right-click / long-press</AppText>
            </View>
          </ModulaContextMenu>
          <ModulaButton
            label="Shared action presenter"
            onPress={() => {
              void presentModulaActions({
                title: 'Shared actions',
                message: 'Legacy callers use the same responsive Modula overlay host.',
                actions: [
                  {id: 'shared-copy', label: 'Copy example', icon: 'share'},
                  {id: 'shared-remove', label: 'Remove example', icon: 'trash', style: 'destructive'},
                ],
              }).then(id => {
                if (id) toast.show({message: `${id} selected`, tone: 'info'})
              })
            }}
            role="secondary"
            size="compact"
          />
        </View>
      </LabSection>

      <LabSection title="Command and feedback">
        <ModulaButtonGroup accessibilityLabel="Command and toast examples">
          <ModulaButton label="Command" onPress={() => setCommand(true)} role="secondary" size="compact" />
          <ModulaTooltip label="Shows one deduplicated success notice">
            <ModulaButton label="Success toast" onPress={() => toast.show({id: 'ui-lab-save', message: 'Saved without duplicate autosave notices.', tone: 'success', actionLabel: 'Undo', onAction: () => undefined})} role="secondary" size="compact" />
          </ModulaTooltip>
          <ModulaButton label="Progress toast" onPress={() => toast.show({id: 'ui-lab-progress', message: 'Preparing preview…', tone: 'info', duration: 0})} role="secondary" size="compact" />
        </ModulaButtonGroup>
      </LabSection>

      <LabSection title="Form adapters">
        <ModulaSearchField
          onChangeText={setSearch}
          placeholder="Search Modula primitives"
          testID="web-adapter-search"
          value={search}
        />
        <ModulaSelectField
          accessibilityLabel="Theme"
          allowClear={false}
          onChange={setSelect}
          options={[{value: 'system', label: 'System'}, {value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}]}
          sheetTitle="Theme"
          value={select}
        />
        <ModulaCombobox
          label="Provider"
          onChange={setCombo}
          options={[{value: 'local', label: 'Local'}, {value: 'openai', label: 'OpenAI'}, {value: 'anthropic', label: 'Anthropic'}]}
          placeholder="Search providers"
          value={combo}
        />
        <ModulaTextInput
          accessibilityLabel="Example field"
          label="Example field"
          onChangeText={setInput}
          placeholder="Type without duplicate events"
          testID="web-adapter-form-input"
          value={input}
        />
        <View style={styles.controlColumn}>
          <ModulaCheckbox
            label="Sync this workspace"
            onValueChange={setChecked}
            testID="web-adapter-checkbox"
            value={checked}
          />
          <View style={styles.labelledControl}>
            <AppText variant="body">Automatic updates</AppText>
            <ModulaSwitch
              accessibilityLabel="Automatic updates"
              onValueChange={setSwitched}
              testID="web-adapter-toggle"
              value={switched}
            />
          </View>
          <ModulaRadioGroup
            choices={[
              {id: 'daily', label: 'Daily', description: 'Run every day'},
              {id: 'weekly', label: 'Weekly', description: 'Run once a week'},
              {id: 'disabled', label: 'Unavailable', disabled: true},
            ]}
            label="Backup frequency"
            onValueChange={setChoice}
            testID="web-adapter-radio"
            value={choice}
          />
          <ModulaRange
            label="Blur strength"
            max={100}
            onValueChange={setRange}
            testID="web-adapter-range"
            value={range}
          />
          <ModulaStepper
            label="Column count"
            max={6}
            min={1}
            onValueChange={setStepper}
            testID="web-adapter-stepper"
            value={stepper}
          />
          <View style={styles.wrap}>
            {['installed', 'productivity', 'developer'].map(value => (
              <ModulaChip
                filter
                key={value}
                label={value[0].toUpperCase() + value.slice(1)}
                onPress={() => setChip(value)}
                selected={chip === value}
                testID={`web-adapter-chip-${value}`}
              />
            ))}
          </View>
        </View>
      </LabSection>

      <LabSection title="Feedback and data">
        {notificationVisible ? (
          <ModulaNotification
            action={{label: 'Open', onPress: () => toast.show({message: 'Notification action selected', tone: 'info'})}}
            description="Vault Notes finished syncing through the semantic feedback layer."
            icon="notifications"
            onDismiss={() => setNotificationVisible(false)}
            testID="web-adapter-notification"
            timestamp="Now"
            title="Sync complete"
          />
        ) : (
          <ModulaButton label="Restore notification" onPress={() => setNotificationVisible(true)} role="secondary" />
        )}
        <ModulaProgress label="Module installation" progress={0.64} testID="web-adapter-progress" />
        <ModulaProgress label="Preparing preview" testID="web-adapter-preloader" />
        <ModulaDataTable
          accessibilityLabel="Installed module status"
          columns={[
            {id: 'module', label: 'Module'},
            {id: 'state', label: 'State'},
            {id: 'version', label: 'Version', numeric: true},
          ]}
          rows={[
            {id: 'vault', cells: {module: 'Vault Notes', state: 'Installed', version: '1.7.0'}},
            {id: 'crm', cells: {module: 'CRM', state: 'Compatible', version: '0.9.2'}},
          ]}
          testID="web-adapter-data-table"
        />
      </LabSection>

      <LabSection title="List primitives">
        <ModulaList testID="web-adapter-konsta-list">
          <ModulaListItem
            onPress={() => toast.show({message: 'Vault Notes selected', tone: 'info'})}
            supportingText="Existing semantic row rendered by the web list adapter"
            title="Vault Notes"
          />
          <ModulaListItem supportingText="Non-interactive detail row" title="Version 1.7.0" />
        </ModulaList>
      </LabSection>

      <LabSection title="Floating action">
        <ModulaFloatingButton
          icon="create"
          label="New note"
          onPress={() => toast.show({message: 'New note action selected', tone: 'info'})}
          prominent
        />
      </LabSection>

      <LabSection title="State continuity">
        <ModulaTextInput
          accessibilityLabel="Unsaved note draft"
          chrome="plain"
          multiline
          onChangeText={setDraft}
          testID="web-adapter-unsaved-note"
          value={draft}
        />
        <View style={styles.wrap}>
          <ModulaButton
            label="Open editor tools"
            onPress={() => setDrawer('drill-in')}
            role="secondary"
            testID="web-adapter-open-editor-tools"
          />
          <ModulaButton
            label="Save note"
            onPress={() => {
              setSavedDraft(draft)
              setSaveCount(value => value + 1)
            }}
            testID="web-adapter-save-note"
          />
        </View>
        <AppText colour="textSecondary" testID="web-adapter-save-evidence" variant="caption">
          Saves: {saveCount}{savedDraft ? ` · ${savedDraft}` : ''}
        </AppText>
      </LabSection>

      <LabSection title="Tabs and toggles">
        <ModulaTabs
          accessibilityLabel="Adapter specimens"
          onValueChange={setTab}
          presentation="underline"
          tabs={[{id: 'drawer', label: 'Drawer'}, {id: 'menu', label: 'Menu'}, {id: 'forms', label: 'Forms'}]}
          value={tab}
        />
        <ModulaToggleGroup
          accessibilityLabel="Formatting"
          items={[{id: 'bold', label: 'Bold'}, {id: 'italic', label: 'Italic'}, {id: 'underline', label: 'Underline'}]}
          onValueChange={setToggles}
          testID="web-adapter-toggle-group"
          value={toggles}
        />
      </LabSection>

      <ModulaDrawerNavigator
        initialRoute="tools"
        isPresented={drawer === 'drill-in'}
        onDismiss={() => setDrawer(null)}
        presentation="tools"
        screens={drawerScreens}
        testID="web-adapter-drill-in-drawer"
      />

      <ModulaDrawer
        detents={[...detents]}
        footer={drawer === 'input' ? <ModulaButton fullWidth label="Done" onPress={() => setDrawer(null)} /> : undefined}
        isPresented={drawer !== null && drawer !== 'drill-in'}
        onDismiss={() => { setNestedModal(false); setDrawer(null) }}
        presentation={presentation}
        testID="web-adapter-active-drawer"
        title={drawer === 'tools' ? 'Tools' : drawer === 'true-nested' ? 'Account tools' : drawerLabel(drawer)}>
        <DrawerContents
          input={input}
          onInputChange={setInput}
          onTrueNested={() => setNestedModal(true)}
          specimen={drawer}
        />
        <PresentationSpecimenControls />
        <ModulaDrawer
          footer={<ModulaButton fullWidth label="Confirm" onPress={() => setNestedModal(false)} />}
          isPresented={nestedModal}
          onDismiss={() => setNestedModal(false)}
          presentation="picker"
          testID="web-adapter-true-nested-modal"
          title="Confirm independent task">
          <View style={{gap: spacing[3]}}>
            <AppText variant="body">This separate modal context requires an explicit confirmation.</AppText>
            <AppText variant="caption" colour="textSecondary">The account tools surface remains available after this task closes.</AppText>
            <PresentationSpecimenControls />
          </View>
        </ModulaDrawer>
      </ModulaDrawer>

      <ModulaEdgeSheet
        direction={sheet ?? 'right'}
        isPresented={sheet !== null}
        onDismiss={() => setSheet(null)}
        presentation="configuration"
        title={`Sheet · ${sheet ?? 'right'}`}>
        <View style={{gap: spacing[3]}}>
          <AppText variant="body" colour="textSecondary">Edge panel for a persistent task; no snap gesture is required.</AppText>
          <PresentationSpecimenControls />
        </View>
      </ModulaEdgeSheet>

      <ModulaDialog
        isPresented={dialog !== null}
        onDismiss={() => setDialog(null)}
        size={dialog ?? 'regular'}
        title={`Dialog · ${dialog ?? 'regular'}`}>
        <View style={{gap: spacing[3]}}>
          <AppText variant="body" colour="textSecondary">Focused, centered task with content-driven height.</AppText>
          <PresentationSpecimenControls />
          <ModulaMenu
            accessibilityLabel="Open dialog menu"
            actions={[
              {id: 'dialog-copy', label: 'Copy value'},
              {id: 'dialog-remove', label: 'Remove value', style: 'destructive'},
            ]}
            onAction={id => toast.show({message: `${id} selected`, tone: 'info'})}
            title="Dialog actions"
            trigger={<AppText variant="buttonLabel">Dialog menu</AppText>}
          />
        </View>
      </ModulaDialog>

      <ModulaCommand actions={commandActions} isOpen={command} onOpenChange={setCommand} testID="web-adapter-command" />
    </View>
  )
}

function PresentationSpecimenControls() {
  const {preferences} = useAppearance()
  const actions = useAppearanceActions()
  return (
    <View style={styles.controlColumn}>
      <ModulaSegmentedPicker
        accessibilityLabel="Change presentation while overlay is open"
        appearance="segmented"
        options={[
          {value: 'liquid', label: 'Liquid'},
          {value: 'material', label: 'Material'},
        ]}
        testID="web-adapter-open-overlay-presentation"
        value={preferences.webPresentation}
        onValueChange={value => {
          if (value === 'liquid' || value === 'material') actions.setWebPresentation(value)
        }}
      />
      <View style={styles.wrap}>
        <ModulaButton
          label="Teal accent"
          onPress={() => actions.setAccent('modulaTeal')}
          role="secondary"
          size="compact"
          testID="web-adapter-open-overlay-accent-teal"
        />
        <ModulaButton
          label="Violet accent"
          onPress={() => actions.setAccent('vividViolet')}
          role="secondary"
          size="compact"
          testID="web-adapter-open-overlay-accent-violet"
        />
      </View>
    </View>
  )
}

function DrawerContents({
  specimen,
  onTrueNested,
  input,
  onInputChange,
}: {
  specimen: DrawerSpecimen | null
  onTrueNested: () => void
  input: string
  onInputChange: (value: string) => void
}) {
  const {spacing} = useThemeTokens()
  if (specimen === 'tools') {
    return (
      <View style={{gap: spacing[3]}}>
        <ModulaListSection title="Create">
          {TOOL_ACTIONS.map((label, index) => <ModulaListRow key={label} last={index === TOOL_ACTIONS.length - 1} title={label} variant="action" />)}
        </ModulaListSection>
        <ModulaListSection title="Installed">
          {['Formatting', 'Vault AI', 'Vault Voice'].map((label, index, values) => <ModulaListRow key={label} last={index === values.length - 1} title={label} variant="navigation" />)}
        </ModulaListSection>
      </View>
    )
  }
  if (specimen === 'true-nested') {
    return (
      <ModulaListSection footer="Independent confirmation is intentionally a separate modal context." title="Account">
        <ModulaListRow last onPress={onTrueNested} testID="web-adapter-open-true-nested" title="Transfer workspace ownership" variant="navigation" />
      </ModulaListSection>
    )
  }
  if (specimen === 'input') {
    return <ModulaTextInput accessibilityLabel="Drawer input" autoFocus onChangeText={onInputChange} placeholder="Type with the keyboard open" value={input} />
  }
  if (specimen === 'long') {
    return <View style={{gap: spacing[2]}}>{Array.from({length: 24}, (_, index) => <AppText key={index} variant="body">Scrollable row {index + 1}</AppText>)}</View>
  }
  if (specimen === 'filters') {
    return <ModulaListSection title="Availability">{['Installed', 'First-party', 'Offline ready'].map((label, index, values) => <ModulaListRow key={label} last={index === values.length - 1} selected={index === 0} title={label} variant="toggle" />)}</ModulaListSection>
  }
  if (specimen === 'picker-drawer') {
    return <ModulaListSection title="Theme">{['System', 'Light', 'Dark', 'OLED'].map((label, index, values) => <ModulaListRow accessory="check" key={label} last={index === values.length - 1} selected={label === 'System'} title={label} variant="value" />)}</ModulaListSection>
  }
  if (specimen === 'action-drawer') {
    return <ModulaListSection>{['Share', 'Save', 'Copy link', 'Report'].map((label, index, values) => <ModulaListRow key={label} last={index === values.length - 1} title={label} variant={label === 'Report' ? 'destructive' : 'action'} />)}</ModulaListSection>
  }
  return <AppText variant="body" colour="textSecondary">Content-sized by default and capped by the dynamic viewport.</AppText>
}

type DrawerRoute = 'tools' | 'formatting' | 'font'

function createDrawerNavigationScreens(
  font: string,
  setFont: (font: string) => void,
  fontQuery: string,
  setFontQuery: (query: string) => void,
): readonly ModulaDrawerScreen<DrawerRoute>[] {
  return [
    {
      id: 'tools',
      title: 'Tools',
      render: navigation => (
        <View style={styles.drawerNavigationSections}>
          <PresentationSpecimenControls />
          <ModulaListSection title="Create">
            {['Photo', 'File', 'Voice', 'AI'].map((label, index, values) => (
              <ModulaListRow key={label} last={index === values.length - 1} title={label} variant="action" />
            ))}
          </ModulaListSection>
          <ModulaListSection title="Installed tools">
            <ModulaListRow onPress={() => navigation.push('formatting')} testID="web-adapter-open-formatting" title="Formatting" variant="navigation" />
            {['Camera', 'Poll', 'Vault AI', 'Vault Voice', 'Manage tools'].map((label, index, values) => (
              <ModulaListRow key={label} last={index === values.length - 1} title={label} variant="navigation" />
            ))}
          </ModulaListSection>
        </View>
      ),
    },
    {
      id: 'formatting',
      title: 'Formatting',
      parentLabel: 'Tools',
      render: navigation => (
        <View style={styles.drawerNavigationSections}>
          <PresentationSpecimenControls />
          <ModulaListSection title="Text">
            <ModulaListRow metadata={font} onPress={() => navigation.push('font')} testID="web-adapter-open-font" title="Font" variant="navigation" />
            <ModulaListRow metadata="Regular" title="Style" variant="navigation" />
            <ModulaListRow last metadata="17" title="Size" variant="navigation" />
          </ModulaListSection>
          <ModulaListSection title="Paragraph">
            <ModulaListRow metadata="Left" title="Alignment" variant="navigation" />
            <ModulaListRow last metadata="Default" title="Line spacing" variant="navigation" />
          </ModulaListSection>
          <ModulaListSection>
            <ModulaListRow last onPress={() => setFont('System')} title="Reset formatting" variant="destructive" />
          </ModulaListSection>
        </View>
      ),
    },
    {
      id: 'font',
      title: 'Font',
      parentLabel: 'Formatting',
      render: () => (
        <View style={styles.drawerNavigationSections}>
          <PresentationSpecimenControls />
          <ModulaTextInput
            accessibilityLabel="Search fonts"
            onChangeText={setFontQuery}
            placeholder="Search fonts"
            value={fontQuery}
          />
          <ModulaListSection title="Font family">
            {['System', 'Serif', 'Monospace']
              .filter(label => label.toLowerCase().includes(fontQuery.trim().toLowerCase()))
              .map((label, index, values) => (
                <ModulaListRow
                  accessory="check"
                  accessibilityRole="radio"
                  accessibilityState={{checked: font === label}}
                  key={label}
                  last={index === values.length - 1}
                  onPress={() => setFont(label)}
                  selected={font === label}
                  testID={`web-adapter-font-${label.toLowerCase()}`}
                  title={label}
                  variant="value"
                />
              ))}
          </ModulaListSection>
        </View>
      ),
    },
  ]
}

function drawerLabel(specimen: DrawerSpecimen | null): string {
  return DRAWER_SPECIMENS.find(candidate => candidate.id === specimen)?.label ?? 'Drawer'
}

function LabSection({title, children}: {title: string; children: React.ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}} testID={`web-adapter-${title.toLowerCase().replaceAll(' ', '-')}`}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  controlColumn: {gap: 12},
  contextTarget: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 12},
  drawerNavigationSections: {gap: 16},
  labelledControl: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
  root: {paddingBottom: 48},
  surfaceGrid: {display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  surfaceSpecimen: {flex: 1, gap: 4, minWidth: 220, padding: 16},
  wrap: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8},
})
