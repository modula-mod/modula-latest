import {ModulaMotionTabs} from '@/platform/ui/tabs'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import type {ProfileTabManifest} from '@/features/profile/contracts/profileTabs'

type ProfileTabBarProps = {
  tabs: ProfileTabManifest[]
  selectedTabId: string
  onSelectTab: (tabId: string) => void
}

/**
 * Profile content tabs — Modula motion-tabs port (LayoutAnimation, no Reanimated).
 * Long-press opens a native context menu with a tab picker (Expo UI Picker).
 * See docs/research/phase4-5-third-party-ui-libs.md.
 */
export function ProfileTabBar({
  tabs,
  selectedTabId,
  onSelectTab,
}: ProfileTabBarProps) {
  const tabItems = tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    accessibilityLabel:
      tab.id === 'modules'
        ? 'Select Modules profile tab'
        : tab.accessibilityLabel,
  }))

  const actions: ModulaActionItem[] = [
    {
      id: 'open-tab',
      label: 'Open tab',
      icon: 'board',
      picker: {
        options: tabs.map(tab => ({id: tab.id, label: tab.title})),
        selectedId: selectedTabId,
      },
    },
  ]

  return (
    <ModulaContextMenu
      fit="fill"
      accessibilityLabel="Profile tabs"
      title="Profile tabs"
      actions={actions}
      onAction={onSelectTab}>
      <ModulaMotionTabs
        tabs={tabItems}
        selectedTabId={selectedTabId}
        onSelectTab={onSelectTab}
      />
    </ModulaContextMenu>
  )
}
