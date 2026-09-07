import {useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaButtonGroup} from '@/platform/ui/buttons/modula-button-group'
import {ModulaCommand} from '@/platform/ui/command/modula-command'
import {useModulaCommandShortcut} from '@/platform/ui/command/use-modula-command-shortcut'
import {ModulaCombobox} from '@/platform/ui/controls/modula-combobox'
import {ModulaSelectField} from '@/platform/ui/controls/modula-select-field'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {ModulaToggleGroup} from '@/platform/ui/controls/modula-toggle-group'
import {ModulaDialog, type ModulaDialogSize} from '@/platform/ui/dialogs'
import {
  ModulaDrawer,
  ModulaDrawerNavigator,
  type ModulaDrawerPresentation,
  type ModulaDrawerScreen,
} from '@/platform/ui/drawers'
import {ModulaTooltip, useModulaToast} from '@/platform/ui/feedback'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaPopover} from '@/platform/ui/menus/modula-popover'
import {ModulaListRow, ModulaListSection} from '@/platform/ui/lists'
import {ModulaEdgeSheet} from '@/platform/ui/sheets/modula-edge-sheet'
import type {ModulaSheetDirection} from '@/platform/ui/sheets/modula-sheet.types'
import {ModulaTabs} from '@/platform/ui/tabs/modula-tabs-control'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
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
  const [font, setFont] = useState('System')
  const [fontQuery, setFontQuery] = useState('')
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
    <View style={[styles.root, {gap: spacing[5]}]} testID="web-ui-adapter-lab">
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
        <View style={styles.wrap}>
          <ModulaButton label="Preview light" onPress={() => appearance.setMode('light')} role="secondary" size="compact" testID="web-adapter-theme-light" />
          <ModulaButton label="Preview dark" onPress={() => appearance.setMode('dark')} role="secondary" size="compact" testID="web-adapter-theme-dark" />
          <ModulaButton label="Preview OLED" onPress={() => appearance.setMode('oled')} role="secondary" size="compact" testID="web-adapter-theme-oled" />
          <ModulaButton label="Reduce motion" onPress={() => appearance.setReduceMotion('on')} role="secondary" size="compact" testID="web-adapter-reduce-motion" />
          <ModulaButton label="Reduce transparency" onPress={() => appearance.setReduceTransparency('on')} role="secondary" size="compact" testID="web-adapter-reduce-transparency" />
          <ModulaButton label="Increase contrast" onPress={() => appearance.setIncreaseContrast('on')} role="secondary" size="compact" testID="web-adapter-increase-contrast" />
        </View>
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
          </View>
        </ModulaDrawer>
      </ModulaDrawer>

      <ModulaEdgeSheet
        direction={sheet ?? 'right'}
        isPresented={sheet !== null}
        onDismiss={() => setSheet(null)}
        presentation="configuration"
        title={`Sheet · ${sheet ?? 'right'}`}>
        <AppText variant="body" colour="textSecondary">Edge panel for a persistent task; no snap gesture is required.</AppText>
      </ModulaEdgeSheet>

      <ModulaDialog
        isPresented={dialog !== null}
        onDismiss={() => setDialog(null)}
        size={dialog ?? 'regular'}
        title={`Dialog · ${dialog ?? 'regular'}`}>
        <AppText variant="body" colour="textSecondary">Focused, centered task with content-driven height.</AppText>
      </ModulaDialog>

      <ModulaCommand actions={commandActions} isOpen={command} onOpenChange={setCommand} testID="web-adapter-command" />
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
  contextTarget: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 12},
  drawerNavigationSections: {gap: 16},
  root: {paddingBottom: 48},
  wrap: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8},
})
