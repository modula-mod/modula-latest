import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  FORGE_AI_ACTIONS,
  FORGE_CAPABILITIES,
  FORGE_EVENT_OPTIONS,
  FORGE_INSPIRATION_TIPS,
  FORGE_MONETISATION_OPTIONS,
  FORGE_TEST_TARGETS,
  FORGE_TEMPLATES,
  FORGE_WIDGET_OPTIONS,
  FORGE_WORKSPACE_MODES,
  buildForgeManifestPreview,
  buildForgeRiskSummary,
  buildForgeSkillPreview,
  buildPublishChecklist,
  forgeChatReply,
  type ForgeCanvasNodeId,
  type ForgeMonetisationOption,
  type ForgeVersionSnapshot,
  type ForgeWorkspaceMode,
} from '@/features/product/data/forgeDraft'
import {
  MODULE_PERMISSION_CATALOGUE,
  RISK_LABEL,
  runPermissionsSecurityScan,
} from '@/features/product/data/modulePermissions'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {selectionHaptic} from '@/lib/haptics'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CANVAS: Array<{
  id: ForgeCanvasNodeId
  label: string
  icon: AppIconName
  x: number
  y: number
}> = [
  {id: 'route', label: 'Route', icon: 'link', x: 16, y: 16},
  {id: 'board', label: 'Board', icon: 'board', x: 140, y: 24},
  {id: 'tab', label: 'Profile tab', icon: 'profile', x: 260, y: 16},
  {id: 'settings', label: 'Settings', icon: 'settings', x: 36, y: 110},
  {id: 'tool', label: 'Composer', icon: 'create', x: 160, y: 118},
  {id: 'auto', label: 'Automation', icon: 'automation', x: 280, y: 110},
  {id: 'agent', label: 'Agent', icon: 'tools', x: 90, y: 210},
  {id: 'widget', label: 'Widget', icon: 'modules', x: 230, y: 210},
]

export function ForgeStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const [mode, setMode] = useState<ForgeWorkspaceMode>('plan')
  const [description, setDescription] = useState(
    'A Modula module draft — Plan Mode first, then Build.',
  )
  const [repoUrl, setRepoUrl] = useState('https://github.com/modula-mod/my-module')
  const [surfaces, setSurfaces] = useState<ForgeCanvasNodeId[]>(['route', 'board', 'tab'])
  const [caps, setCaps] = useState<string[]>(['board.card', 'profile.tab'])
  const [perms, setPerms] = useState<string[]>(['storage:namespaced', 'profile:read'])
  const [selected, setSelected] = useState<ForgeCanvasNodeId>('route')
  const [chat, setChat] = useState('')
  const [chatLog, setChatLog] = useState<Array<{role: 'you' | 'forge'; text: string}>>([
    {
      role: 'forge',
      text: 'Plan Mode ready. Describe the module — or pick a template. Preview replies only (not a model).',
    },
  ])
  const [versions, setVersions] = useState<ForgeVersionSnapshot[]>([])
  const [planNotes, setPlanNotes] = useState(
    '· Profile tab for owners\n· Board card for quick access\n· Least-privilege storage',
  )
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(['quick-summary'])
  const [selectedAiActions, setSelectedAiActions] = useState<string[]>([])
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'module.installed',
    'board.card.created',
  ])
  const [checkedTests, setCheckedTests] = useState<string[]>([])
  const [monetisation, setMonetisation] =
    useState<ForgeMonetisationOption['id']>('free')

  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  const manifest = useMemo(
    () =>
      buildForgeManifestPreview({
        name: preferences.forgeDraftName,
        description,
        capabilities: caps,
        permissions: perms,
        surfaces,
        repositoryUrl: repoUrl,
        widgets: selectedWidgets,
        aiActions: selectedAiActions,
        events: selectedEvents,
        testTargets: checkedTests,
        monetisation,
      }),
    [
      caps,
      checkedTests,
      description,
      monetisation,
      perms,
      preferences.forgeDraftName,
      repoUrl,
      selectedAiActions,
      selectedEvents,
      selectedWidgets,
      surfaces,
    ],
  )

  const skillPreview = useMemo(
    () =>
      buildForgeSkillPreview({
        name: preferences.forgeDraftName,
        description,
        capabilities: caps,
        permissions: perms,
        surfaces,
        widgets: selectedWidgets,
        aiActions: selectedAiActions,
        events: selectedEvents,
        monetisation,
      }),
    [
      caps,
      description,
      monetisation,
      perms,
      preferences.forgeDraftName,
      selectedAiActions,
      selectedEvents,
      selectedWidgets,
      surfaces,
    ],
  )

  const checklist = useMemo(
    () =>
      buildPublishChecklist({
        name: preferences.forgeDraftName,
        description,
        permissions: perms,
        surfaces,
        repositoryUrl: repoUrl,
      }),
    [description, perms, preferences.forgeDraftName, repoUrl, surfaces],
  )

  const scan = useMemo(() => runPermissionsSecurityScan(perms), [perms])
  const riskSummary = useMemo(() => buildForgeRiskSummary(perms), [perms])
  const readyCount = checklist.filter(item => item.ok).length

  const toggleString = (value: string, setter: (updater: (prev: string[]) => string[]) => void) => {
    setter(prev => (prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]))
  }

  const ensureCaps = (capabilities: string[]) => {
    setCaps(prev => Array.from(new Set([...prev, ...capabilities])))
  }

  const applyTemplate = (id: string) => {
    const template = FORGE_TEMPLATES.find(item => item.id === id)
    if (!template) return
    void selectionHaptic()
    void update({forgeDraftName: `${template.name} Module`})
    setDescription(template.description)
    setSurfaces([...template.surfaces])
    setCaps([...template.capabilities])
    setPerms([...template.permissions])
    setSelectedWidgets(
      FORGE_WIDGET_OPTIONS.filter(widget => template.capabilities.includes(widget.capability)).map(
        widget => widget.id,
      ),
    )
    setSelectedAiActions(
      FORGE_AI_ACTIONS.filter(action => template.capabilities.includes(action.capability)).map(
        action => action.id,
      ),
    )
    setSelectedEvents([
      'module.installed',
      ...(template.surfaces.includes('board') ? ['board.card.created'] : []),
      ...(template.surfaces.includes('tab') ? ['profile.tab.opened'] : []),
      ...(template.surfaces.includes('auto') ? ['automation.triggered'] : []),
    ])
    setMode('build')
    setChatLog(prev => [
      ...prev,
      {role: 'forge', text: `Template “${template.name}” applied. Continue in Build, then Preview.`},
    ])
  }

  const sendChat = () => {
    const text = chat.trim()
    if (!text) return
    void selectionHaptic()
    const reply = forgeChatReply(text, {
      name: preferences.forgeDraftName || 'My Module',
      surfaces,
    })
    setChatLog(prev => [...prev, {role: 'you', text}, {role: 'forge', text: reply}])
    setChat('')
  }

  const saveVersion = () => {
    void selectionHaptic()
    const stamp = new Date().toISOString()
    setVersions(prev => [
      {
        id: stamp,
        label: `v${prev.length + 1} · ${preferences.forgeDraftName || 'Draft'}`,
        at: stamp,
        manifest,
      },
      ...prev,
    ])
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Forge Builder" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView contentContainerStyle={{gap: spacing[4], padding: spacing[4]}}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[
              styles.hero,
              {
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[2],
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              FORGE · PLAN → BUILD → PREVIEW
            </AppText>
            <AppText variant="display">Build modules inside Modula.</AppText>
            <AppText variant="body" colour="textSecondary">
              Craft inspired by Lovable Plan Mode, Bolt Preview/Code panes, and Base44 Discussion +
              Security Scan — remapped to Greenfield modules. No codegen or publish yet.
            </AppText>
          </LinearGradient>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.modes, {gap: spacing[2]}]}>
              {FORGE_WORKSPACE_MODES.map(item => {
                const on = mode === item.id
                return (
                  <AppPressable
                    key={item.id}
                    accessibilityLabel={item.label}
                    onPress={() => {
                      void selectionHaptic()
                      setMode(item.id)
                    }}
                    style={[
                      styles.mode,
                      {
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[3],
                        borderRadius: radius.round,
                        backgroundColor: on ? colours.accent : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppText
                      variant="label"
                      style={{color: on ? colours.accentForeground : colours.text}}>
                      {item.label}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          </ScrollView>
          <AppText variant="caption" colour="textTertiary">
            {FORGE_WORKSPACE_MODES.find(item => item.id === mode)?.hint}
          </AppText>

          {mode === 'plan' ? (
            <View style={{gap: spacing[4]}}>
              <AppText variant="headline">Templates</AppText>
              <View style={[styles.grid, {gap: spacing[3]}]}>
                {FORGE_TEMPLATES.map(template => (
                  <AppPressable
                    key={template.id}
                    accessibilityLabel={template.name}
                    onPress={() => applyTemplate(template.id)}
                    style={[
                      styles.template,
                      {
                        backgroundColor: colours.surface,
                        borderColor: colours.border,
                        borderRadius: radius.large,
                        padding: spacing[4],
                        gap: spacing[2],
                      },
                    ]}>
                    <AppIcon name="modules" colour={colours.accent} />
                    <AppText variant="headline">{template.name}</AppText>
                    <AppText variant="caption" colour="accent">
                      {template.blurb}
                    </AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {template.description}
                    </AppText>
                  </AppPressable>
                ))}
              </View>
              <Surface
                variant="contained"
                style={[
                  styles.inspiration,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.large,
                    padding: spacing[4],
                    gap: spacing[2],
                  },
                ]}>
                <AppText variant="headline">Inspiration</AppText>
                {FORGE_INSPIRATION_TIPS.map(tip => (
                  <AppText key={tip} variant="caption" colour="textSecondary">
                    · {tip}
                  </AppText>
                ))}
              </Surface>
              <AppText variant="headline">Plan notes</AppText>
              <TextInput
                value={planNotes}
                onChangeText={setPlanNotes}
                multiline
                accessibilityLabel="Plan notes"
                style={[
                  styles.input,
                  styles.multiline,
                  {
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    borderRadius: radius.medium,
                    color: colours.text,
                    padding: spacing[4],
                  },
                ]}
              />
              <AppButton onPress={() => setMode('build')}>Approve plan → Build</AppButton>
            </View>
          ) : null}

          {mode === 'build' ? (
            <View style={{gap: spacing[4]}}>
              <View style={{gap: spacing[2]}}>
                <AppText variant="label">Module name</AppText>
                <TextInput
                  value={preferences.forgeDraftName}
                  onChangeText={value => {
                    void update({forgeDraftName: value})
                  }}
                  accessibilityLabel="Module draft name"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                      borderRadius: radius.medium,
                      color: colours.text,
                      paddingHorizontal: spacing[4],
                    },
                  ]}
                />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  accessibilityLabel="Description"
                  style={[
                    styles.input,
                    styles.multiline,
                    {
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                      borderRadius: radius.medium,
                      color: colours.text,
                      padding: spacing[3],
                    },
                  ]}
                />
              </View>

              <Surface
                variant="contained"
                style={[
                  styles.canvas,
                  {
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    height: 300,
                  },
                ]}>
                {CANVAS.map(node => {
                  const on = surfaces.includes(node.id)
                  const active = selected === node.id
                  return (
                    <AppPressable
                      key={node.id}
                      accessibilityLabel={node.label}
                      onPress={() => {
                        setSelected(node.id)
                        setSurfaces(prev =>
                          on ? prev.filter(id => id !== node.id) : [...prev, node.id],
                        )
                      }}
                      style={[
                        styles.node,
                        {
                          left: node.x,
                          top: node.y,
                          backgroundColor: on ? colours.accentSubtle : colours.surfaceRaised,
                          borderColor: active || on ? colours.accent : colours.border,
                          borderRadius: radius.medium,
                          padding: spacing[3],
                          gap: spacing[1],
                        },
                      ]}>
                      <AppIcon name={node.icon} colour={colours.accent} size={16} />
                      <AppText variant="micro">{node.label}</AppText>
                    </AppPressable>
                  )
                })}
              </Surface>

              <AppText variant="headline">Capabilities</AppText>
              <View style={[styles.chips, {gap: spacing[2]}]}>
                {FORGE_CAPABILITIES.map(cap => {
                  const on = caps.includes(cap)
                  return (
                    <AppPressable
                      key={cap}
                      onPress={() =>
                        setCaps(prev => (on ? prev.filter(item => item !== cap) : [...prev, cap]))
                      }
                      style={[
                        styles.chip,
                        {
                          backgroundColor: on ? colours.accentSubtle : colours.surface,
                          borderColor: on ? colours.accent : colours.border,
                          borderRadius: radius.round,
                          paddingHorizontal: spacing[3],
                          paddingVertical: spacing[2],
                        },
                      ]}>
                      <AppText variant="caption" colour={on ? 'accent' : 'textSecondary'}>
                        {cap}
                      </AppText>
                    </AppPressable>
                  )
                })}
              </View>

              <AppText variant="headline">Permissions</AppText>
              <Surface
                variant="contained"
                style={[
                  styles.riskPanel,
                  {
                    padding: spacing[4],
                    gap: spacing[1],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="caption" colour="accent">
                  Risk score · {riskSummary.score}
                </AppText>
                <AppText variant="headline">{riskSummary.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {riskSummary.detail}
                </AppText>
              </Surface>
              <View style={{gap: spacing[2]}}>
                {MODULE_PERMISSION_CATALOGUE.map(perm => {
                  const on = perms.includes(perm.id)
                  return (
                    <AppPressable
                      key={perm.id}
                      onPress={() =>
                        setPerms(prev =>
                          on ? prev.filter(item => item !== perm.id) : [...prev, perm.id],
                        )
                      }
                      style={[
                        styles.permRow,
                        {
                          backgroundColor: on ? colours.accentSubtle : colours.surface,
                          borderColor: on ? colours.accent : colours.border,
                          borderRadius: radius.medium,
                          padding: spacing[3],
                          gap: spacing[2],
                        },
                      ]}>
                      <View style={{flex: 1, gap: 2}}>
                        <AppText variant="label">{perm.label}</AppText>
                        <AppText variant="caption" colour="textSecondary">
                          {perm.userVisible}
                        </AppText>
                      </View>
                      <AppText variant="caption" colour="textTertiary">
                        {RISK_LABEL[perm.risk]}
                      </AppText>
                    </AppPressable>
                  )
                })}
              </View>

              <Surface
                variant="contained"
                style={[
                  styles.chat,
                  {
                    padding: spacing[4],
                    gap: spacing[3],
                    borderRadius: radius.large,
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="headline">Forge chat · Discussion</AppText>
                <AppText variant="caption" colour="textTertiary">
                  Base44 Discussion mode energy — does not change Registry or run models.
                </AppText>
                {chatLog.map((entry, index) => (
                  <AppText
                    key={`${entry.role}-${index}`}
                    variant="caption"
                    colour={entry.role === 'forge' ? 'textSecondary' : 'text'}>
                    {entry.role === 'forge' ? 'Forge · ' : 'You · '}
                    {entry.text}
                  </AppText>
                ))}
                <TextInput
                  value={chat}
                  onChangeText={setChat}
                  placeholder="Ask about permissions, publish, templates…"
                  placeholderTextColor={colours.textTertiary}
                  accessibilityLabel="Forge chat"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                      borderRadius: radius.medium,
                      color: colours.text,
                      paddingHorizontal: spacing[3],
                    },
                  ]}
                />
                <AppButton onPress={sendChat}>Send Preview reply</AppButton>
              </Surface>
              <AppButton onPress={() => setMode('widgets')}>Configure widgets and events</AppButton>
            </View>
          ) : null}

          {mode === 'widgets' ? (
            <View style={{gap: spacing[4]}}>
              <View style={{gap: spacing[2]}}>
                <AppText variant="headline">Board widgets</AppText>
                <AppText variant="body" colour="textSecondary">
                  Pick widgets to include in the Board Preview. These are draft manifest entries only.
                </AppText>
              </View>
              {FORGE_WIDGET_OPTIONS.map(widget => {
                const on = selectedWidgets.includes(widget.id)
                return (
                  <AppPressable
                    key={widget.id}
                    accessibilityLabel={widget.label}
                    onPress={() => {
                      toggleString(widget.id, setSelectedWidgets)
                      ensureCaps(['widget.board', widget.capability])
                      if (!surfaces.includes('widget')) setSurfaces(prev => [...prev, 'widget'])
                      if (!surfaces.includes('board')) setSurfaces(prev => [...prev, 'board'])
                    }}
                    style={[
                      styles.checkRow,
                      {
                        padding: spacing[3],
                        gap: spacing[2],
                        borderRadius: radius.medium,
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppIcon
                      name={on ? 'check' : 'modules'}
                      colour={on ? colours.accent : colours.textTertiary}
                      size={18}
                    />
                    <View style={{flex: 1, gap: 2}}>
                      <AppText variant="label">{widget.label}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        {widget.description}
                      </AppText>
                    </View>
                    <AppText variant="caption" colour="textTertiary">
                      {widget.capability}
                    </AppText>
                  </AppPressable>
                )
              })}

              <Surface
                variant="contained"
                style={[
                  styles.warningPanel,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.large,
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="headline">AI actions</AppText>
                <AppText variant="caption" colour="textSecondary">
                  Read-only summarise, draft reply, and extract tasks need GAIA scopes + AKI before
                  they can execute. Toggles here only update the Preview draft.
                </AppText>
                {FORGE_AI_ACTIONS.map(action => {
                  const on = selectedAiActions.includes(action.id)
                  return (
                    <AppPressable
                      key={action.id}
                      accessibilityLabel={action.label}
                      onPress={() => {
                        toggleString(action.id, setSelectedAiActions)
                        ensureCaps(['agent.scope', action.capability])
                        if (!perms.includes('agent:scope')) setPerms(prev => [...prev, 'agent:scope'])
                        if (!surfaces.includes('agent')) setSurfaces(prev => [...prev, 'agent'])
                      }}
                      style={[
                        styles.checkRow,
                        {
                          padding: spacing[3],
                          gap: spacing[2],
                          borderRadius: radius.medium,
                          backgroundColor: on ? colours.accentSubtle : colours.surface,
                          borderColor: on ? colours.accent : colours.border,
                        },
                      ]}>
                      <AppIcon
                        name={on ? 'check' : 'tools'}
                        colour={on ? colours.accent : colours.textTertiary}
                        size={18}
                      />
                      <View style={{flex: 1, gap: 2}}>
                        <AppText variant="label">{action.label}</AppText>
                        <AppText variant="caption" colour="textSecondary">
                          {action.description}
                        </AppText>
                      </View>
                    </AppPressable>
                  )
                })}
              </Surface>

              <View style={{gap: spacing[2]}}>
                <AppText variant="headline">Events emitted / consumed</AppText>
                <AppText variant="body" colour="textSecondary">
                  Checklist for the module contract. These do not start a live event bus.
                </AppText>
              </View>
              {FORGE_EVENT_OPTIONS.map(event => {
                const on = selectedEvents.includes(event.id)
                return (
                  <AppPressable
                    key={event.id}
                    accessibilityLabel={event.label}
                    onPress={() => toggleString(event.id, setSelectedEvents)}
                    style={[
                      styles.checkRow,
                      {
                        padding: spacing[3],
                        gap: spacing[2],
                        borderRadius: radius.medium,
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppIcon
                      name={on ? 'check' : 'event'}
                      colour={on ? colours.accent : colours.textTertiary}
                      size={18}
                    />
                    <View style={{flex: 1, gap: 2}}>
                      <AppText variant="label">{event.label}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        {event.direction.toUpperCase()} · {event.description}
                      </AppText>
                    </View>
                  </AppPressable>
                )
              })}
              <AppButton onPress={() => setMode('preview')}>Open Preview</AppButton>
            </View>
          ) : null}

          {mode === 'preview' ? (
            <View style={{gap: spacing[4]}}>
              <AppText variant="headline">Live shell mock</AppText>
              <AppText variant="body" colour="textSecondary">
                Bolt-style Preview pane — local mock only.
              </AppText>
              <Surface
                variant="contained"
                style={[
                  styles.previewShell,
                  {
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    padding: spacing[4],
                    gap: spacing[4],
                  },
                ]}>
                <View style={{gap: spacing[1]}}>
                  <AppText variant="caption" colour="textTertiary">
                    PROFILE TAB
                  </AppText>
                  <AppText variant="title">
                    {surfaces.includes('tab')
                      ? preferences.forgeDraftName || 'Module'
                      : 'Tab not selected'}
                  </AppText>
                  <AppText variant="body" colour="textSecondary">
                    {description}
                  </AppText>
                </View>
                {surfaces.includes('board') ? (
                  <View
                    style={[
                      styles.boardCard,
                      {
                        backgroundColor: colours.accentSubtle,
                        borderRadius: radius.medium,
                        padding: spacing[3],
                        gap: spacing[2],
                      },
                    ]}>
                    <AppIcon name="board" colour={colours.accent} />
                    <AppText variant="headline">
                      {(preferences.forgeDraftName || 'Module') + ' card'}
                    </AppText>
                    <AppText variant="caption" colour="textSecondary">
                      Board surface · Local Preview
                    </AppText>
                  </View>
                ) : null}
                {surfaces.includes('widget') && selectedWidgets.length > 0 ? (
                  <View style={{gap: spacing[2]}}>
                    <AppText variant="caption" colour="textTertiary">
                      BOARD WIDGETS
                    </AppText>
                    {FORGE_WIDGET_OPTIONS.filter(widget => selectedWidgets.includes(widget.id)).map(
                      widget => (
                        <View
                          key={widget.id}
                          style={[
                            styles.widgetPreview,
                            {
                              borderRadius: radius.medium,
                              borderColor: colours.border,
                              padding: spacing[3],
                              gap: spacing[1],
                            },
                          ]}>
                          <AppText variant="label">{widget.label}</AppText>
                          <AppText variant="caption" colour="textSecondary">
                            {widget.description}
                          </AppText>
                        </View>
                      ),
                    )}
                  </View>
                ) : null}
                {surfaces.includes('settings') ? (
                  <AppText variant="caption" colour="accent">
                    Settings section registered · /settings/extensions/…
                  </AppText>
                ) : null}
                {surfaces.includes('agent') ? (
                  <AppText variant="caption" colour="textSecondary">
                    Agent scope · never silent private-module access
                  </AppText>
                ) : null}
              </Surface>

              <Surface
                variant="contained"
                style={[
                  styles.manifest,
                  {
                    padding: spacing[4],
                    gap: spacing[3],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="headline">Test matrix · Preview</AppText>
                <AppText variant="caption" colour="textSecondary">
                  iOS / Android / Web checkboxes are local-only. They do not run CI or device tests.
                </AppText>
                {FORGE_TEST_TARGETS.map(target => {
                  const on = checkedTests.includes(target.id)
                  return (
                    <AppPressable
                      key={target.id}
                      accessibilityLabel={target.label}
                      onPress={() => toggleString(target.id, setCheckedTests)}
                      style={[
                        styles.checkRow,
                        {
                          padding: spacing[3],
                          gap: spacing[2],
                          borderRadius: radius.medium,
                          backgroundColor: on ? colours.accentSubtle : colours.surfaceRaised,
                          borderColor: on ? colours.accent : colours.border,
                        },
                      ]}>
                      <AppIcon
                        name={on ? 'check' : 'warning'}
                        colour={on ? colours.accent : colours.textTertiary}
                        size={18}
                      />
                      <View style={{flex: 1}}>
                        <AppText variant="label">{target.label}</AppText>
                        <AppText variant="caption" colour="textSecondary">
                          {target.description}
                        </AppText>
                      </View>
                    </AppPressable>
                  )
                })}
              </Surface>

              <Surface
                variant="contained"
                style={[
                  styles.manifest,
                  {
                    padding: spacing[4],
                    gap: spacing[3],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="headline">Monetisation Preview</AppText>
                <AppText variant="caption" colour="textSecondary">
                  Pricing is draft metadata only. DIMON is not active yet, so paid module
                  economics cannot run. Forge does not create wallets, balances, tokens, mints,
                  checkout sessions, subscriptions, or settlement records.
                </AppText>
                {FORGE_MONETISATION_OPTIONS.map(option => {
                  const on = monetisation === option.id
                  return (
                    <AppPressable
                      key={option.id}
                      accessibilityLabel={option.label}
                      onPress={() => {
                        setMonetisation(option.id)
                        ensureCaps(['monetisation.preview'])
                      }}
                      style={[
                        styles.checkRow,
                        {
                          padding: spacing[3],
                          gap: spacing[2],
                          borderRadius: radius.medium,
                          backgroundColor: on ? colours.accentSubtle : colours.surfaceRaised,
                          borderColor: on ? colours.accent : colours.border,
                        },
                      ]}>
                      <AppIcon
                        name={on ? 'check' : 'marketplace'}
                        colour={on ? colours.accent : colours.textTertiary}
                        size={18}
                      />
                      <View style={{flex: 1, gap: 2}}>
                        <AppText variant="label">{option.label}</AppText>
                        <AppText variant="caption" colour="textSecondary">
                          {option.description}
                        </AppText>
                      </View>
                    </AppPressable>
                  )
                })}
                <AppButton disabled onPress={() => undefined}>
                  Checkout disabled in Preview
                </AppButton>
              </Surface>
              <AppButton onPress={() => setMode('manifest')}>Review manifest</AppButton>
            </View>
          ) : null}

          {mode === 'manifest' ? (
            <View style={{gap: spacing[4]}}>
              <Surface
                variant="contained"
                style={[
                  styles.riskPanel,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.large,
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="caption" colour="accent">
                  Risk score · {riskSummary.score}
                </AppText>
                <AppText variant="headline">{riskSummary.label}</AppText>
                <AppText variant="body" colour="textSecondary">
                  {riskSummary.detail}
                </AppText>
                <AppText variant="caption" colour="textTertiary">
                  Preview score from declared permissions only; Registry security checks still run
                  later.
                </AppText>
              </Surface>

              <AppText variant="headline">Security Scan · Preview</AppText>
              {scan.map(finding => (
                <Surface
                  key={finding.id}
                  variant="contained"
                  style={[
                    styles.finding,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surface,
                      borderColor:
                        finding.severity === 'high'
                          ? colours.accent
                          : colours.border,
                    },
                  ]}>
                  <AppText variant="caption" colour="accent">
                    {RISK_LABEL[finding.severity]}
                  </AppText>
                  <AppText variant="headline">{finding.title}</AppText>
                  <AppText variant="body" colour="textSecondary">
                    {finding.body}
                  </AppText>
                </Surface>
              ))}

              <AppText variant="headline">
                Publish readiness · {readyCount}/{checklist.length}
              </AppText>
              {checklist.map(item => (
                <Surface
                  key={item.id}
                  variant="contained"
                  style={[
                    styles.checkRow,
                    {
                      padding: spacing[3],
                      gap: spacing[2],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppIcon
                    name={item.ok ? 'check' : 'warning'}
                    colour={item.ok ? colours.accent : colours.textTertiary}
                    size={18}
                  />
                  <View style={{flex: 1}}>
                    <AppText variant="label">{item.label}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {item.detail}
                    </AppText>
                  </View>
                </Surface>
              ))}

              <Surface
                variant="contained"
                style={[
                  styles.manifest,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="label">Manifest JSON</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {manifest}
                </AppText>
              </Surface>

              <Surface
                variant="contained"
                style={[
                  styles.manifest,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="label">skill.md Preview · digital DNA</AppText>
                <ScrollView
                  nestedScrollEnabled
                  style={styles.markdownScroll}
                  contentContainerStyle={{paddingBottom: spacing[1]}}>
                  <AppText
                    selectable
                    variant="caption"
                    colour="textSecondary"
                    style={styles.markdownText}>
                    {skillPreview}
                  </AppText>
                </ScrollView>
              </Surface>

              <AppButton onPress={saveVersion}>Save version snapshot</AppButton>
              {versions.length > 0 ? (
                <View style={{gap: spacing[2]}}>
                  <AppText variant="headline">Version history</AppText>
                  {versions.map(version => (
                    <AppPressable
                      key={version.id}
                      onPress={() => {
                        void selectionHaptic()
                        setChatLog(prev => [
                          ...prev,
                          {
                            role: 'forge',
                            text: `Restored view of ${version.label} (local snapshot — edit fields to match).`,
                          },
                        ])
                      }}>
                      <AppText variant="caption" colour="accent">
                        {version.label} · {version.at.slice(0, 19)}
                      </AppText>
                    </AppPressable>
                  ))}
                </View>
              ) : null}

              <AppText variant="caption" colour="textTertiary">
                Publish status: Draft only · last change local · sandbox inactive
              </AppText>
            </View>
          ) : null}

          <AppButton onPress={() => router.push('/product/permissions' as Href)}>
            Full permissions matrix
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/nft' as Href)}>
            NFT product preview
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/atlas' as Href)}>
            Atlas product preview
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/module-standards' as Href)}>
            Module standards
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/commands' as Href)}>
            Command Layer
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/sandbox' as Href)}>
            Sandbox foreshadow
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/marketplace/module-forge' as Href)}>
            Marketplace card
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth, width: '100%'},
  modes: {flexDirection: 'row'},
  mode: {borderWidth: StyleSheet.hairlineWidth},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  template: {borderWidth: StyleSheet.hairlineWidth, flexBasis: '47%', flexGrow: 1, minWidth: 150},
  inspiration: {borderWidth: StyleSheet.hairlineWidth},
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  multiline: {minHeight: 100, textAlignVertical: 'top'},
  canvas: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  node: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: StyleSheet.hairlineWidth},
  permRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  chat: {borderWidth: StyleSheet.hairlineWidth},
  previewShell: {borderWidth: StyleSheet.hairlineWidth, minHeight: 220},
  boardCard: {},
  riskPanel: {borderWidth: StyleSheet.hairlineWidth},
  warningPanel: {borderWidth: StyleSheet.hairlineWidth},
  widgetPreview: {borderWidth: StyleSheet.hairlineWidth},
  finding: {borderWidth: StyleSheet.hairlineWidth},
  checkRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  manifest: {borderWidth: StyleSheet.hairlineWidth},
  markdownScroll: {maxHeight: 420, width: '100%'},
  markdownText: {lineHeight: 18},
})
