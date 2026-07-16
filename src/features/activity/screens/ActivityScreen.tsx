import {ScrollView, StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {demoActivity, type DemoActivityEvent} from '@/demo/demoActivity'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const groups = ['Today', 'This week', 'Earlier'] as const

export function ActivityScreen() {
  const {colours, spacing} = useThemeTokens()

  if (!demoActivity.length) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <EmptyState
          icon="activity"
          title="No activity yet"
          description="Local likes, replies, mentions, and module updates will appear here."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <AppText variant="display">Activity</AppText>
          {groups.map(group => {
            const items = demoActivity.filter(item => item.group === group)
            if (!items.length) return null
            return (
              <View key={group} style={{gap: spacing[3]}}>
                <AppText variant="headline">{group}</AppText>
                <View style={{gap: spacing[2]}}>
                  {items.map(item => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                </View>
              </View>
            )
          })}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function ActivityRow({item}: {item: DemoActivityEvent}) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <Surface
      variant="plain"
      style={[styles.row, {gap: spacing[3], paddingVertical: spacing[2]}]}>
      {item.actor ? (
        <Avatar
          name={item.actor.displayName}
          colour={item.actor.avatarColour}
          size={42}
        />
      ) : (
        <View
          style={[
            styles.iconAvatar,
            {
              backgroundColor: colours.accentSubtle,
              borderRadius: radius.round,
            },
          ]}>
          <AppIcon name={item.icon ?? 'activity'} colour={colours.accent} />
        </View>
      )}
      <View style={styles.body}>
        <AppText variant="body">
          {item.actor ? `${item.actor.displayName} ` : ''}
          {item.description}
        </AppText>
        <AppText variant="caption" colour="textSecondary">
          {item.timestamp}
        </AppText>
        {item.preview ? (
          <View
            style={[
              styles.preview,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.medium,
                marginTop: spacing[2],
                padding: spacing[3],
              },
            ]}>
            <AppText variant="caption" colour="textSecondary">
              {item.preview}
            </AppText>
          </View>
        ) : null}
      </View>
      {item.actionLabel ? (
        <AppPressable
          accessibilityLabel={item.actionLabel}
          style={[
            styles.action,
            {
              backgroundColor: colours.surfaceMuted,
              borderRadius: radius.round,
            },
          ]}>
          <AppText variant="label">{item.actionLabel}</AppText>
        </AppPressable>
      ) : null}
    </Surface>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  iconAvatar: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  screen: {
    flex: 1,
  },
})
