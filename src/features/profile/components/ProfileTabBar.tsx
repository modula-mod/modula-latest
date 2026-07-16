import {ModulaMotionTabs} from '@/platform/ui/tabs'
import type {ProfileTabManifest} from '@/features/profile/contracts/profileTabs'

type ProfileTabBarProps = {
  tabs: ProfileTabManifest[]
  selectedTabId: string
  onSelectTab: (tabId: string) => void
}

/**
 * Profile content tabs — Modula motion-tabs port (LayoutAnimation, no Reanimated).
 * See docs/research/phase4-5-third-party-ui-libs.md.
 */
export function ProfileTabBar({
  tabs,
  selectedTabId,
  onSelectTab,
}: ProfileTabBarProps) {
  return (
    <ModulaMotionTabs
      tabs={tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        accessibilityLabel:
          tab.id === 'modules'
            ? 'Select Modules profile tab'
            : tab.accessibilityLabel,
      }))}
      selectedTabId={selectedTabId}
      onSelectTab={onSelectTab}
    />
  )
}
