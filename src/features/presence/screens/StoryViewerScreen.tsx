import {useLocalSearchParams, useRouter} from 'expo-router'
import {useEffect, useMemo, useRef, useState} from 'react'
import {Image, Pressable, StyleSheet, View} from 'react-native'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {AppText} from '@/components/primitives/AppText'
import {useSession} from '@/auth/runtime'
import {queryKeys} from '@/data/query'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function StoryViewerScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{groupId?: string}>()
  const groupId = typeof params.groupId === 'string' ? params.groupId : ''
  const session = useSession()
  const {storiesRepository} = useAppServices()
  const queryClient = useQueryClient()
  const {colours, spacing} = useThemeTokens()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const groupQuery = useQuery({
    queryKey: queryKeys.stories.group(groupId),
    enabled: Boolean(groupId),
    queryFn: () => storiesRepository.getGroup(groupId),
  })

  const items = groupQuery.data?.items ?? []
  const current = items[index] ?? null
  const progress = useMemo(() => {
    if (!items.length) return 0
    return (index + 1) / items.length
  }, [index, items.length])

  useEffect(() => {
    if (!current || paused || current.status !== 'ready') return undefined
    if (timerRef.current) clearTimeout(timerRef.current)
    const duration = current.durationMs ?? 5000
    timerRef.current = setTimeout(() => {
      if (index < items.length - 1) setIndex(value => value + 1)
      else router.back()
    }, duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [current, index, items.length, paused, router])

  useEffect(() => {
    if (!current || current.viewed || session.status !== 'signedIn') return
    void storiesRepository.markViewed(current.itemId).then(() => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.stories.rail(session.account.id),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.stories.group(groupId),
      })
    })
  }, [current, groupId, queryClient, session, storiesRepository])

  const deleteCurrent = async () => {
    if (!current || !groupQuery.data?.isOwner) return
    const confirmed = await confirmModulaAction({
      title: 'Delete story?',
      message: 'This story item will be removed for everyone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!confirmed) return
    await storiesRepository.deleteItem(current.itemId)
    if (session.status === 'signedIn') {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.stories.rail(session.account.id),
      })
    }
    router.back()
  }

  if (groupQuery.isLoading) {
    return (
      <View style={[styles.root, {backgroundColor: colours.canvas, padding: spacing[4]}]}>
        <AppText>Loading story…</AppText>
      </View>
    )
  }

  if (groupQuery.isError || !groupQuery.data || !current) {
    return (
      <View style={[styles.root, {backgroundColor: colours.canvas, padding: spacing[4], gap: spacing[3]}]}>
        <AppText>Story unavailable.</AppText>
        <ModulaButton label="Close" role="secondary" onPress={() => router.back()} />
      </View>
    )
  }

  return (
    <View style={[styles.root, {backgroundColor: '#000'}]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {width: `${Math.round(progress * 100)}%`}]} />
      </View>
      <View style={[styles.header, {paddingHorizontal: spacing[4], paddingTop: spacing[6]}]}>
        <AppText style={{color: '#fff'}} variant="label">
          {groupQuery.data.displayName}
        </AppText>
        <ModulaButton label="Close" role="quiet" onPress={() => router.back()} />
      </View>
      <Pressable
        style={styles.media}
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        onPress={event => {
          const x = event.nativeEvent.locationX
          const mid = event.nativeEvent.target ? 180 : 180
          // Left third previous, right third next.
          if (x < mid) setIndex(value => Math.max(0, value - 1))
          else setIndex(value => Math.min(items.length - 1, value + 1))
        }}>
        {current.mediaUrl ? (
          <Image source={{uri: current.mediaUrl}} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : null}
      </Pressable>
      {current.caption ? (
        <AppText style={{color: '#fff', padding: spacing[4]}}>{current.caption}</AppText>
      ) : null}
      {groupQuery.data.isOwner ? (
        <View style={{padding: spacing[4]}}>
          <ModulaButton label="Delete story" role="destructive" onPress={() => void deleteCurrent()} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {flex: 1},
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  media: {
    flex: 1,
  },
})
