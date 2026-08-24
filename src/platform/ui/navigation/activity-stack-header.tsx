import {useRouter, type Href} from 'expo-router'

import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'

type ActivityHeaderRightProps = {
  onMarkRead: () => void
  onOpenFilters: () => void
}

/** Leading back — glass disc (not a multi-item group). */
export function ActivityHeaderLeft() {
  return <ModulaBackButton chrome="plain" />
}

/**
 * Trailing Activity control group via shared `ChromeGlassControlGroup`.
 * mark-read + settings + overflow in one liquid-glass capsule.
 */
export function ActivityHeaderRight({
  onMarkRead,
  onOpenFilters,
}: ActivityHeaderRightProps) {
  const router = useRouter()
  return (
    <ChromeGlassControlGroup
      items={[
        {
          kind: 'button',
          icon: 'check',
          accessibilityLabel: 'Mark all as read',
          onPress: onMarkRead,
        },
        {
          kind: 'button',
          icon: 'settings',
          accessibilityLabel: 'Notification settings',
          onPress: () => router.push('/settings/notifications' as Href),
        },
        {
          kind: 'menu',
          icon: 'more',
          accessibilityLabel: 'Activity actions',
          title: 'Activity',
          actions: [
            {id: 'filter', label: 'Filters', icon: 'settings'},
            {id: 'markRead', label: 'Mark all as read', icon: 'check'},
            {id: 'customize', label: 'Customize Activity', icon: 'appearance'},
            {id: 'quiet', label: 'Quiet inbox', icon: 'privacy'},
          ],
          onAction: id => {
            if (id === 'filter') onOpenFilters()
            if (id === 'markRead') onMarkRead()
            if (id === 'customize') router.push('/product/layout-activity' as Href)
            if (id === 'quiet') router.push('/product/quiet-inbox' as Href)
          },
        },
      ]}
    />
  )
}

/** @deprecated Prefer ActivityHeaderLeft — kept for layout import stability. */
export function activityHeaderLeftItems() {
  return undefined
}

/** @deprecated Prefer ActivityHeaderRight — shared ChromeGlassControlGroup. */
export function activityHeaderRightItems(_props: ActivityHeaderRightProps) {
  return undefined
}

/** Retained name for phase7m-b6 presentation guards (settings glyph lives in the group). */
export function ActivitySettingsButton() {
  const router = useRouter()
  return (
    <ChromeGlassControlGroup
      items={[
        {
          kind: 'button',
          icon: 'settings',
          accessibilityLabel: 'Notification settings',
          onPress: () => router.push('/settings/notifications' as Href),
        },
      ]}
    />
  )
}
