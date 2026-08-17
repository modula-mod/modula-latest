import {Pressable, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import type {ProfileSnapshotPageDescriptor} from '@/features/profile/model/profile-snapshot'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileSnapshotNavProps = {
  pages: ProfileSnapshotPageDescriptor[]
  selectedId: string
  onSelect: (index: number) => void
}

/**
 * Labeled outer pager navigator. Dots never appear alone — the user must
 * know which major profile surface they are moving to.
 */
export function ProfileSnapshotNav({pages, selectedId, onSelect}: ProfileSnapshotNavProps) {
  const {colours, spacing} = useThemeTokens()
  const {fontScale} = useWindowDimensions()
  const compact = fontScale < PROFILE_LAYOUT.stackedFontScale

  const items = pages.map((page, index) => {
    const active = page.id === selectedId
    return (
      <Pressable
        key={page.id}
        accessibilityRole="button"
        accessibilityLabel={`${page.number} ${page.label}`}
        accessibilityState={{selected: active}}
        testID={`profile-snapshot-nav-${page.id}`}
        hitSlop={8}
        onPress={() => onSelect(index)}
        style={[styles.item, compact ? styles.itemGrow : null]}>
        <AppText
          variant="micro"
          colour={active ? 'text' : 'textSecondary'}
          numberOfLines={1}
          style={styles.label}>
          {page.number} {page.label}
        </AppText>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: active ? colours.accent : colours.textTertiary,
              opacity: active ? 1 : 0.52,
              width: PROFILE_LAYOUT.pagerIndicatorSize,
              height: PROFILE_LAYOUT.pagerIndicatorSize,
              borderRadius: PROFILE_LAYOUT.pagerIndicatorSize / 2,
            },
          ]}
        />
      </Pressable>
    )
  })

  if (!compact) {
    return (
      <ScrollView
        horizontal
        testID="profile-snapshot-nav"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, {gap: spacing[3]}]}>
        {items}
      </ScrollView>
    )
  }

  return (
    <View style={styles.row} testID="profile-snapshot-nav">
      {items}
    </View>
  )
}

const styles = StyleSheet.create({
  dot: {
    overflow: 'hidden',
  },
  item: {
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  itemGrow: {
    flex: 1,
  },
  label: {
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minWidth: 0,
    width: '100%',
  },
  scroll: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 36,
  },
})
