import {useMemo, useState} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {
  SettingsSection,
  SettingsToggleRow,
} from '@/features/settings/components/SettingsRows'
import {SystemSwitch} from '@/components/system/SystemSwitch'
import {profileTabIdsFromPresentation} from '@/features/product/data/profileTabsSync'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {coreProfileTabs} from '@/features/profile/data/coreProfileTabs'
import {ProfileMetricCustomizer} from '@/features/profile/components/ProfileMetricCustomizer'
import {
  DEFAULT_PROFILE_PRESENTATION,
  type ProfileLayoutId,
  type ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileActions} from '@/features/profile/runtime/useProfileActions'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
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

const tabPreviewDescriptions: Record<string, string> = {
  shop:
    'Preview slot for products, services, downloads, and reserved entitlements. The slot does not enable checkout, wallet balances, minting, or live NFT ownership.',
  agents:
    'Preview slot for owner-scoped assistants such as summarising, scheduling, research, and CRM support. Agents remain governed by explicit scopes.',
}

export function CustomizeProfileScreen() {
  const router = useRouter()
  const {presentation} = useProfile()
  const {setProfilePresentation} = useProfileActions()
  const {update: updateProductPrefs} = useProductPreferences()
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
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

  const persistPresentation = (next: ProfilePresentationPreferences) => {
    const normalised = normalisePresentation(next)
    setProfilePresentation(normalised)
    void updateProductPrefs({
      profileTabIds: profileTabIdsFromPresentation(normalised),
    })
    return normalised
  }

  const save = () => {
    persistPresentation(draft)
    router.back()
  }

  const preview = () => {
    persistPresentation(draft)
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

  const enabledTabs = draft.tabOrder.filter(tabId => draft.enabledTabIds.includes(tabId))

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title="Customize"
        onBack={leave}
        right={
          <ChromeGlassControlGroup
            items={[
              {
                kind: 'button',
                icon: 'check',
                accessibilityLabel: 'Save profile presentation',
                onPress: save,
              },
              {
                kind: 'menu',
                accessibilityLabel: 'Customize profile actions',
                title: 'Customize',
                actions: [
                  {id: 'save', label: 'Save', icon: 'check'},
                  {id: 'preview', label: 'Preview profile', icon: 'profile'},
                  {id: 'reset', label: 'Reset', icon: 'reset', style: 'destructive'},
                ],
                onAction: id => {
                  if (id === 'save') save()
                  if (id === 'preview') preview()
                  if (id === 'reset') reset()
                },
              },
            ]}
          />
        }
      />
      <ResponsiveContent maxWidth={820}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            {gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding},
          ]}>
          <Section title="Profile layout">
            <ModulaSegmentedPicker
              appearance="segmented"
              accessibilityLabel="Profile layout"
              options={layoutOptions.map(option => ({
                value: option.id,
                label: option.title,
              }))}
              value={draft.layoutId}
              onValueChange={next =>
                setDraft(prev => ({...prev, layoutId: next as ProfileLayoutId}))
              }
            />
            <AppText variant="caption" colour="textSecondary">
              {layoutOptions.find(option => option.id === draft.layoutId)?.description}
            </AppText>
          </Section>

          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="textSecondary">
              Choose visitor-facing tabs. Long-press a row to reorder.
            </AppText>
            <SettingsSection title="Profile tabs">
              {draft.tabOrder.map((tabId, index) => {
                const manifest = coreProfileTabs.find(tab => tab.id === tabId)
                if (!manifest) return null
                const enabled = draft.enabledTabIds.includes(tabId)
                const last = index === draft.tabOrder.length - 1
                const sourceLabel =
                  manifest.source === 'module'
                    ? 'Module · Preview'
                    : manifest.visibility === 'public'
                      ? 'Public'
                      : manifest.visibility === 'followers'
                        ? 'Followers'
                        : 'Owner only'
                const description = tabPreviewDescriptions[tabId]
                  ? `${sourceLabel}. ${tabPreviewDescriptions[tabId]}`
                  : sourceLabel
                return (
                  <View
                    key={tabId}
                    style={[
                      styles.tabRow,
                      {
                        borderBottomColor: last ? 'transparent' : colours.separator,
                        paddingHorizontal: spacing[4],
                      },
                    ]}>
                    <ModulaContextMenu
                      accessibilityLabel={`${manifest.title} tab. Long press to reorder`}
                      actions={[
                        {
                          id: 'up',
                          label: 'Move up',
                          icon: 'arrowUp',
                          disabled: index === 0,
                        },
                        {
                          id: 'down',
                          label: 'Move down',
                          icon: 'arrowDown',
                          disabled: index === draft.tabOrder.length - 1,
                        },
                      ]}
                      onAction={id => {
                        if (id === 'up') setDraft(prev => moveTab(prev, tabId, 'up'))
                        if (id === 'down') setDraft(prev => moveTab(prev, tabId, 'down'))
                      }}
                      title={manifest.title}>
                      <View style={[styles.tabMain, {gap: spacing[3]}]}>
                        <AppIcon name={manifest.icon} colour={colours.text} size={20} />
                        <View style={styles.tabBody}>
                          <AppText variant="body">{manifest.title}</AppText>
                          <AppText variant="caption" colour="textTertiary" numberOfLines={2}>
                            {description}
                          </AppText>
                        </View>
                      </View>
                    </ModulaContextMenu>
                    <SystemSwitch
                      value={enabled}
                      disabled={tabId === 'posts'}
                      onValueChange={value =>
                        setDraft(prev => toggleTab(prev, tabId, value))
                      }
                    />
                  </View>
                )
              })}
            </SettingsSection>
          </View>

          <Section title="Default tab">
            <ModulaSegmentedPicker
              appearance="plain"
              scrollable
              accessibilityLabel="Default profile tab"
              options={enabledTabs.map(tabId => {
                const manifest = coreProfileTabs.find(tab => tab.id === tabId)
                return {
                  value: tabId,
                  label: manifest?.title ?? tabId,
                }
              })}
              value={draft.defaultTabId}
              onValueChange={next => setDraft(prev => ({...prev, defaultTabId: next}))}
            />
          </Section>

          <ProfileMetricCustomizer draft={draft} onChange={setDraft} />

          <SettingsSection title="Profile indicators">
            <SettingsToggleRow
              label="Show Focus Halo"
              description="A small availability ring around your avatar. It follows Focus and does not reveal private modules."
              value={draft.showFocusHalo}
              onValueChange={value =>
                setDraft(prev => ({...prev, showFocusHalo: value}))
              }
              last
            />
          </SettingsSection>
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

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  screen: {
    flex: 1,
  },
  tabBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  tabMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  tabRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
    width: '100%',
  },
})
