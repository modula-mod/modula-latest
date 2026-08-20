import {Pressable, StyleSheet, View} from 'react-native'

import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import type {ProfileSnapshotPageDescriptor} from '@/features/profile/model/profile-snapshot'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileSnapshotNavProps = {
  pages: ProfileSnapshotPageDescriptor[]
  selectedId: string
  onSelect: (index: number) => void
}

const CAPSULE_WIDTH = 16
const CAPSULE_HEIGHT = 3

/**
 * Minimal outer pager indicator. Active page is a short capsule; inactive
 * pages are dots. Labels stay on the accessibility tree only.
 */
export function ProfileSnapshotNav({pages, selectedId, onSelect}: ProfileSnapshotNavProps) {
  const {colours, spacing} = useThemeTokens()
  const dot = PROFILE_LAYOUT.pagerIndicatorSize

  return (
    <View style={[styles.row, {gap: spacing[2]}]} testID="profile-snapshot-nav">
      {pages.map((page, index) => {
        const active = page.id === selectedId
        return (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            accessibilityLabel={`${page.number} ${page.label}`}
            accessibilityState={{selected: active}}
            testID={`profile-snapshot-nav-${page.id}`}
            hitSlop={10}
            onPress={() => onSelect(index)}
            style={styles.item}>
            <View
              style={
                active
                  ? [
                      styles.capsule,
                      {
                        backgroundColor: colours.accent,
                        width: CAPSULE_WIDTH,
                        height: CAPSULE_HEIGHT,
                        borderRadius: CAPSULE_HEIGHT / 2,
                      },
                    ]
                  : [
                      styles.dot,
                      {
                        backgroundColor: colours.textTertiary,
                        opacity: 0.55,
                        width: dot,
                        height: dot,
                        borderRadius: dot / 2,
                      },
                    ]
              }
            />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  capsule: {
    overflow: 'hidden',
  },
  dot: {
    overflow: 'hidden',
  },
  item: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 2,
    width: '100%',
  },
})
