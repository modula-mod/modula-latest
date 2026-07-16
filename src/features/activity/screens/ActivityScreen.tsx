import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {useSession} from '@/auth/runtime'
import {useActivityQuery} from '@/features/activity/data'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {ActivityItem} from '@/domain/activity'

const groups = ['Today', 'This week', 'Earlier'] as const
type ActivityFilter = 'all' | ActivityItem['type']

export function ActivityScreen() {
  const {colours, spacing} = useThemeTokens()
  const activityQuery = useActivityQuery()
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const activity = activityQuery.data?.pages.flatMap(page => page.items) ?? []
  const filtered = useMemo(
    () => (filter === 'all' ? activity : activity.filter(item => item.type === filter)),
    [activity, filter],
  )

  if (activityQuery.isLoading) {
    return <InitialLoadingState label="Loading activity" />
  }

  if (activityQuery.isError) {
    return <QueryErrorState error={activityQuery.error} onRetry={() => void activityQuery.refetch()} />
  }

  if (!activity.length) {
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
          <View style={styles.titleRow}>
            <AppText variant="display">Activity</AppText>
            <ModulaMenu
              accessibilityLabel="Filter activity"
              title="Filter activity"
              actions={[
                {id: 'all', label: 'All'},
                {id: 'like', label: 'Likes'},
                {id: 'reply', label: 'Replies'},
                {id: 'follow', label: 'Follows'},
                {id: 'mention', label: 'Mentions'},
                {id: 'moduleUpdate', label: 'Modules'},
                {id: 'teamInvitation', label: 'Teams'},
              ]}
              onAction={id => setFilter(id as ActivityFilter)}
              trigger={<AppIcon name="more" colour={colours.textSecondary} />}
            />
          </View>
          {filter !== 'all' ? (
            <AppText variant="caption" colour="textSecondary">
              Showing {filter} · Preview filters are local
            </AppText>
          ) : null}
          {groups.map(group => {
            const items = filtered.filter(item => item.group === group)
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

function ActivityRow({item}: {item: ActivityItem}) {
  const router = useRouter()
  const session = useSession()
  const {colours, radius, spacing} = useThemeTokens()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const profileRoute = item.actor
    ? getProfileRouteForIdentity(item.actor, ownerProfileId)
    : null

  const openDestination = () => {
    if (item.type === 'moduleUpdate') {
      router.push('/marketplace/module-vault-notes' as Href)
      return
    }
    if (item.type === 'teamInvitation') {
      router.push('/teams' as Href)
      return
    }
    if (item.type === 'like' || item.type === 'reply' || item.type === 'mention') {
      router.push('/' as Href)
      return
    }
    if (profileRoute) {
      router.push(profileRoute)
    }
  }

  return (
    <Surface
      variant="plain"
      style={[styles.row, {gap: spacing[3], paddingVertical: spacing[2]}]}>
      {item.actor && profileRoute ? (
        <AppPressable
          accessibilityLabel={`Open ${item.actor.displayName} profile`}
          onPress={() => router.push(profileRoute)}
          style={styles.actorPress}>
          <Avatar
            name={item.actor.displayName}
            uri={item.actor.avatarUri}
            colour={item.actor.coverColour}
            size={42}
          />
        </AppPressable>
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
      <AppPressable
        accessibilityLabel={item.description}
        onPress={openDestination}
        style={styles.body}>
        {item.actor ? (
          <AppText variant="body">
            {item.actor.displayName} {item.description}
          </AppText>
        ) : (
          <AppText variant="body">{item.description}</AppText>
        )}
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
      </AppPressable>
      {item.actionLabel ? (
        <AppPressable
          accessibilityLabel={item.actionLabel}
          onPress={openDestination}
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
  actorPress: {
    alignItems: 'center',
    justifyContent: 'center',
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
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
