import {useMemo, useState} from 'react'
import {Alert, ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {coreProfileTabs} from '@/features/profile/data/coreProfileTabs'
import {
  DEFAULT_PROFILE_PRESENTATION,
  type ProfileLayoutId,
  type ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileActions} from '@/features/profile/runtime/useProfileActions'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const layoutOptions: {
  id: ProfileLayoutId
  title: string
  description: string
}[] = [
  {
    id: 'social',
    title: 'Social',
    description: 'Posts and social identity stay primary.',
  },
  {
    id: 'creator',
    title: 'Creator',
    description: 'Media and links move higher in the profile.',
  },
  {
    id: 'professional',
    title: 'Professional',
    description: 'Modules and professional context become more prominent.',
  },
  {
    id: 'minimal',
    title: 'Minimal',
    description: 'Reduced visual complexity with compact controls.',
  },
]

export function CustomizeProfileScreen() {
  const router = useRouter()
  const {presentation} = useProfile()
  const {setProfilePresentation} = useProfileActions()
  const {colours, spacing} = useThemeTokens()
  const [draft, setDraft] = useState<ProfilePresentationPreferences>(presentation)
  const initial = useMemo(() => JSON.stringify(presentation), [presentation])
  const dirty = JSON.stringify(draft) !== initial

  const leave = () => {
    if (!dirty) {
      router.back()
      return
    }
    Alert.alert('Discard changes?', 'Your profile presentation changes have not been saved.', [
      {text: 'Keep editing', style: 'cancel'},
      {text: 'Discard', style: 'destructive', onPress: () => router.back()},
    ])
  }

  const save = () => {
    setProfilePresentation(normalisePresentation(draft))
    router.back()
  }

  const preview = () => {
    setProfilePresentation(normalisePresentation(draft))
    router.push('/profile/preview' as Href)
  }

  const reset = () => {
    Alert.alert('Reset profile presentation?', 'This restores the default layout, tabs and indicators.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => setDraft(DEFAULT_PROFILE_PRESENTATION),
      },
    ])
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent maxWidth={820}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, {gap: spacing[5], padding: spacing[4]}]}>
          <View style={styles.header}>
            <HeaderButton label="Cancel" onPress={leave} />
            <AppText variant="headline" style={styles.headerTitle}>
              Customize Profile
            </AppText>
            <HeaderButton label="Save" onPress={save} primary />
          </View>

          <Section title="Profile layout">
            <View style={[styles.layoutGrid, {gap: spacing[3]}]}>
              {layoutOptions.map(option => (
                <LayoutOption
                  key={option.id}
                  option={option}
                  selected={draft.layoutId === option.id}
                  onPress={() => setDraft(prev => ({...prev, layoutId: option.id}))}
                />
              ))}
            </View>
          </Section>

          <Section title="Profile tabs">
            <AppText variant="caption" colour="textSecondary">
              Core tabs plus module slots (Shop, Agents). Module tabs stay Preview until packages
              install via Registry.
            </AppText>
            <View style={{gap: spacing[2]}}>
              {draft.tabOrder.map((tabId, index) => {
                const manifest = coreProfileTabs.find(tab => tab.id === tabId)
                if (!manifest) return null
                const enabled = draft.enabledTabIds.includes(tabId)
                const sourceLabel =
                  manifest.source === 'module'
                    ? 'Module · Preview'
                    : manifest.visibility === 'public'
                      ? 'Public'
                      : manifest.visibility === 'followers'
                        ? 'Followers'
                        : 'Owner only'
                return (
                  <Surface
                    key={tabId}
                    variant="contained"
                    style={[styles.tabRow, {gap: spacing[3], padding: spacing[3]}]}>
                    <AppIcon name={manifest.icon} colour={colours.accent} />
                    <View style={styles.tabBody}>
                      <AppText variant="label">{manifest.title}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        {sourceLabel}
                      </AppText>
                    </View>
                    <Switch
                      value={enabled}
                      disabled={tabId === 'posts'}
                      accessibilityLabel={`${enabled ? 'Disable' : 'Enable'} ${manifest.title} tab`}
                      accessibilityState={{disabled: tabId === 'posts'}}
                      onValueChange={value =>
                        setDraft(prev => toggleTab(prev, tabId, value))
                      }
                    />
                    <MoveButton
                      label={`Move ${manifest.title} tab up`}
                      disabled={index === 0}
                      icon="arrowUp"
                      onPress={() =>
                        setDraft(prev => moveTab(prev, tabId, 'up'))
                      }
                    />
                    <MoveButton
                      label={`Move ${manifest.title} tab down`}
                      disabled={index === draft.tabOrder.length - 1}
                      icon="arrowDown"
                      onPress={() =>
                        setDraft(prev => moveTab(prev, tabId, 'down'))
                      }
                    />
                  </Surface>
                )
              })}
            </View>
          </Section>

          <Section title="Default tab">
            <View style={[styles.choiceRow, {gap: spacing[2]}]}>
              {draft.tabOrder
                .filter(tabId => draft.enabledTabIds.includes(tabId))
                .map(tabId => {
                  const manifest = coreProfileTabs.find(tab => tab.id === tabId)
                  if (!manifest) return null
                  const selected = draft.defaultTabId === tabId
                  return (
                    <ChoiceButton
                      key={tabId}
                      label={manifest.title}
                      selected={selected}
                      onPress={() => setDraft(prev => ({...prev, defaultTabId: tabId}))}
                    />
                  )
                })}
            </View>
          </Section>

          <Section title="Profile indicators">
            <Surface variant="contained" style={[styles.indicatorPanel, {padding: spacing[3]}]}>
              <IndicatorSwitch
                label="Show Focus Halo"
                value={draft.showFocusHalo}
                onValueChange={value =>
                  setDraft(prev => ({...prev, showFocusHalo: value}))
                }
              />
              <IndicatorSwitch
                label="Show follower count"
                value={draft.showFollowerCount}
                onValueChange={value =>
                  setDraft(prev => ({...prev, showFollowerCount: value}))
                }
              />
              <IndicatorSwitch
                label="Show module count"
                value={draft.showModuleCount}
                onValueChange={value =>
                  setDraft(prev => ({...prev, showModuleCount: value}))
                }
              />
            </Surface>
          </Section>

          <View style={[styles.footerActions, {gap: spacing[2]}]}>
            <FooterButton label="Preview" icon="profile" onPress={preview} />
            <FooterButton label="Reset" icon="reset" onPress={reset} destructive />
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function normalisePresentation(
  input: ProfilePresentationPreferences,
): ProfilePresentationPreferences {
  const tabOrder = [...new Set(['posts', ...input.tabOrder])]
  const enabledTabIds = [...new Set(['posts', ...input.enabledTabIds])]
  return {
    ...input,
    tabOrder,
    enabledTabIds,
    defaultTabId: enabledTabIds.includes(input.defaultTabId)
      ? input.defaultTabId
      : 'posts',
  }
}

function toggleTab(
  draft: ProfilePresentationPreferences,
  tabId: string,
  enabled: boolean,
): ProfilePresentationPreferences {
  if (tabId === 'posts') return draft
  const enabledTabIds = enabled
    ? [...new Set([...draft.enabledTabIds, tabId])]
    : draft.enabledTabIds.filter(id => id !== tabId)
  return normalisePresentation({
    ...draft,
    enabledTabIds,
    defaultTabId: enabledTabIds.includes(draft.defaultTabId)
      ? draft.defaultTabId
      : 'posts',
  })
}

function moveTab(
  draft: ProfilePresentationPreferences,
  tabId: string,
  direction: 'up' | 'down',
): ProfilePresentationPreferences {
  const tabOrder = [...draft.tabOrder]
  const index = tabOrder.indexOf(tabId)
  const nextIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || nextIndex < 0 || nextIndex >= tabOrder.length) {
    return draft
  }
  const current = tabOrder[index]
  tabOrder[index] = tabOrder[nextIndex]
  tabOrder[nextIndex] = current
  return normalisePresentation({...draft, tabOrder})
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

function HeaderButton({
  label,
  onPress,
  primary,
}: {
  label: string
  onPress: () => void
  primary?: boolean
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.headerButton,
        {
          backgroundColor: primary ? colours.accent : colours.surfaceRaised,
          borderColor: primary ? 'transparent' : colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[3],
        },
      ]}>
      <AppText
        variant="label"
        style={{color: primary ? colours.accentForeground : colours.text}}>
        {label}
      </AppText>
    </AppPressable>
  )
}

function LayoutOption({
  option,
  selected,
  onPress,
}: {
  option: (typeof layoutOptions)[number]
  selected: boolean
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={`Select ${option.title} profile layout`}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.layoutOption,
        {
          backgroundColor: selected ? colours.accentSubtle : colours.surfaceRaised,
          borderColor: selected ? colours.accentBorder : colours.border,
          borderRadius: radius.large,
          gap: spacing[3],
          padding: spacing[3],
        },
      ]}>
      <View style={[styles.layoutPreview, {gap: spacing[1]}]}>
        <View style={[styles.previewLine, {backgroundColor: colours.accent}]} />
        <View style={[styles.previewShort, {backgroundColor: colours.textMuted}]} />
        <View style={[styles.previewTabs, {gap: spacing[1]}]}>
          <View style={[styles.previewTab, {backgroundColor: colours.accentSubtle}]} />
          <View style={[styles.previewTab, {backgroundColor: colours.surfaceMuted}]} />
          <View style={[styles.previewTab, {backgroundColor: colours.surfaceMuted}]} />
        </View>
      </View>
      <View style={{gap: spacing[1]}}>
        <AppText variant="label">{option.title}</AppText>
        <AppText variant="caption" colour="textSecondary">
          {option.description}
        </AppText>
      </View>
    </AppPressable>
  )
}

function MoveButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string
  icon: Parameters<typeof AppIcon>[0]['name']
  disabled: boolean
  onPress: () => void
}) {
  const {colours, radius} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.moveButton,
        {backgroundColor: colours.surfaceRaised, borderColor: colours.border, borderRadius: radius.round},
      ]}>
      <AppIcon name={icon} colour={colours.textSecondary} size={18} />
    </AppPressable>
  )
}

function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={`Set ${label} as default profile tab`}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colours.accentSubtle : colours.surfaceRaised,
          borderColor: selected ? colours.accentBorder : colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[3],
        },
      ]}>
      <AppText
        variant="label"
        style={{color: selected ? colours.accent : colours.text}}>
        {label}
      </AppText>
    </AppPressable>
  )
}

function IndicatorSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (value: boolean) => void
}) {
  return (
    <View style={styles.indicatorRow}>
      <AppText variant="body" style={styles.indicatorLabel}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
      />
    </View>
  )
}

function FooterButton({
  label,
  icon,
  destructive,
  onPress,
}: {
  label: string
  icon: Parameters<typeof AppIcon>[0]['name']
  destructive?: boolean
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.footerButton,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.round,
          gap: spacing[2],
          paddingHorizontal: spacing[4],
        },
      ]}>
      <AppIcon
        name={icon}
        colour={destructive ? colours.destructive : colours.accent}
        size={18}
      />
      <AppText variant="label">{label}</AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  choice: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  content: {
    paddingBottom: 48,
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footerButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  indicatorLabel: {
    flex: 1,
  },
  indicatorPanel: {
    gap: 2,
  },
  indicatorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
  },
  layoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  layoutOption: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 240,
  },
  layoutPreview: {
    minHeight: 56,
  },
  moveButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  previewLine: {
    borderRadius: 999,
    height: 16,
    width: '72%',
  },
  previewShort: {
    borderRadius: 999,
    height: 10,
    width: '46%',
  },
  previewTab: {
    borderRadius: 999,
    flex: 1,
    height: 10,
  },
  previewTabs: {
    flexDirection: 'row',
    marginTop: 6,
    width: '86%',
  },
  screen: {
    flex: 1,
  },
  tabBody: {
    flex: 1,
    minWidth: 0,
  },
  tabRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
