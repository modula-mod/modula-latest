import {useRouter, type Href} from 'expo-router'
import {View} from 'react-native'

import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {
  HEADER_ICON_PAIR_GAP,
  plainHeaderCustomItem,
  plainHeaderSpacing,
  supportsPlainHeaderItems,
} from '@/platform/ui/navigation/plain-header-items'

type ActivityHeaderRightProps = {
  onMarkRead: () => void
  onOpenFilters: () => void
}

function ActivityMarkReadButton({onMarkRead}: {onMarkRead: () => void}) {
  return (
    <ModulaIconButton
      icon="check"
      chrome="plain"
      accessibilityLabel="Mark all as read"
      onPress={onMarkRead}
    />
  )
}

function ActivitySettingsButton() {
  const router = useRouter()
  return (
    <ModulaIconButton
      icon="settings"
      chrome="plain"
      accessibilityLabel="Notification settings"
      onPress={() => router.push('/settings/notifications' as Href)}
    />
  )
}

function ActivityOverflowMenu({
  onMarkRead,
  onOpenFilters,
}: ActivityHeaderRightProps) {
  const router = useRouter()
  return (
    <ChromeOverflowMenu
      chrome="plain"
      accessibilityLabel="Activity actions"
      title="Activity"
      actions={[
        {id: 'filter', label: 'Filters', icon: 'settings'},
        {id: 'markRead', label: 'Mark all as read', icon: 'check'},
        {id: 'customize', label: 'Customize Activity', icon: 'appearance'},
        {id: 'quiet', label: 'Quiet inbox', icon: 'privacy'},
      ]}
      onAction={id => {
        if (id === 'filter') onOpenFilters()
        if (id === 'markRead') onMarkRead()
        if (id === 'customize') router.push('/product/layout-activity' as Href)
        if (id === 'quiet') router.push('/product/quiet-inbox' as Href)
      }}
    />
  )
}

/** Leading capsule — same global back as Profile. */
export function ActivityHeaderLeft() {
  return <ModulaBackButton chrome="plain" />
}

/**
 * Trailing control group: mark-read, settings, overflow.
 * iOS 26 wraps these in one shared glass capsule.
 */
export function ActivityHeaderRight({
  onMarkRead,
  onOpenFilters,
}: ActivityHeaderRightProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: HEADER_ICON_PAIR_GAP,
      }}>
      <ActivityMarkReadButton onMarkRead={onMarkRead} />
      <ActivitySettingsButton />
      <ActivityOverflowMenu
        onMarkRead={onMarkRead}
        onOpenFilters={onOpenFilters}
      />
    </View>
  )
}

export function activityHeaderLeftItems() {
  if (!supportsPlainHeaderItems()) return undefined
  return [plainHeaderCustomItem(<ActivityHeaderLeft />)]
}

export function activityHeaderRightItems(props: ActivityHeaderRightProps) {
  if (!supportsPlainHeaderItems()) return undefined
  return [
    plainHeaderCustomItem(<ActivityMarkReadButton onMarkRead={props.onMarkRead} />),
    plainHeaderSpacing(),
    plainHeaderCustomItem(<ActivitySettingsButton />),
    plainHeaderSpacing(),
    plainHeaderCustomItem(
      <ActivityOverflowMenu
        onMarkRead={props.onMarkRead}
        onOpenFilters={props.onOpenFilters}
      />,
    ),
  ]
}
