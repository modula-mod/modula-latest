import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ActivityItem} from '@/domain/activity'
import {selectionHaptic} from '@/lib/haptics'
import {StackedAvatars} from '@/platform/ui/avatars'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ActivityDigestStripProps = {
  items: ActivityItem[]
  /** IDs the user has already marked read. */
  readIds: Set<string>
  onMarkAllRead: () => void
}

/**
 * Compact digest above the activity list — counts + multi-actor faces.
 * Inspired by notification summary strips, adapted to Modula activity types.
 */
export function ActivityDigestStrip({
  items,
  readIds,
  onMarkAllRead,
}: ActivityDigestStripProps) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  const today = items.filter(item => item.group === 'Today')
  if (!today.length) return null

  const unreadToday = today.filter(item => !readIds.has(item.id))
  const digestSource = unreadToday.length ? unreadToday : today
  const unreadCount = items.filter(item => !readIds.has(item.id)).length
  const replies = digestSource.filter(item => item.type === 'reply').length
  const mentions = digestSource.filter(item => item.type === 'mention').length
  const reactions = digestSource.filter(
    item => item.type === 'like' || item.type === 'reaction',
  ).length

  const faces = digestSource
    .filter(item => item.actor)
    .slice(0, 5)
    .map(item => ({
      id: item.actor!.id,
      name: item.actor!.displayName,
      uri: item.actor!.avatarUri,
      colour: item.actor!.coverColour,
    }))

  const summaryParts = [
    unreadCount > 0 ? `${unreadCount} new` : `${today.length} today`,
    replies > 0 ? `${replies} replies` : null,
    mentions > 0 ? `${mentions} mentions` : null,
    reactions > 0 ? `${reactions} reactions` : null,
  ].filter(Boolean)

  return (
    <SectionEnter delay={40}>
      <AppPressable
        accessibilityLabel={`Activity digest: ${summaryParts.join(', ')}`}
        onPress={() => {
          void selectionHaptic()
          if (unreadCount > 0) onMarkAllRead()
        }}
        style={[
          styles.strip,
          {
            backgroundColor: colours.accentSubtle,
            borderColor: colours.accentBorder,
            borderRadius: radius.xlarge,
            gap: spacing[3],
            padding: spacing[3],
          },
        ]}>
        {faces.length ? (
          <StackedAvatars faces={faces} size={32} max={4} />
        ) : (
          <View
            style={[
              styles.iconWrap,
              {backgroundColor: colours.accent, borderRadius: radius.round},
            ]}>
            <AppIcon name="activity" colour={colours.accentForeground} size={18} />
          </View>
        )}
        <View style={styles.body}>
          <AppText variant="label" colour="accent">
            {summaryParts.join(' · ')}
          </AppText>
          <AppText variant="caption" colour="textSecondary">
            {unreadCount > 0
              ? 'Tap to mark today’s notifications as read'
              : 'You’re caught up for today'}
          </AppText>
        </View>
        <AppPressable
          accessibilityLabel="Open notification settings"
          onPress={() => {
            void selectionHaptic()
            router.push('/settings/notifications' as Href)
          }}
          style={styles.settingsHit}>
          <AppIcon name="notifications" colour={colours.accent} size={18} />
        </AppPressable>
      </AppPressable>
    </SectionEnter>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  iconWrap: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  settingsHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  strip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
