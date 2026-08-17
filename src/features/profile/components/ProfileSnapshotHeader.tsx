import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ProfileSnapshotPageDescriptor} from '@/features/profile/model/profile-snapshot'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileSnapshotHeaderProps = {
  page: ProfileSnapshotPageDescriptor
  index: number
  count: number
}

export function ProfileSnapshotHeader({page, index, count}: ProfileSnapshotHeaderProps) {
  const {colours, spacing} = useThemeTokens()

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, {paddingBottom: spacing[1]}]}
      testID="profile-snapshot-header">
      <View style={[styles.identity, {gap: spacing[1]}]}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: colours.accentSubtle,
              borderRadius: 4,
            },
          ]}>
          <AppText variant="micro" colour="accent">
            {page.number}
          </AppText>
        </View>
        <AppText variant="headline" numberOfLines={1} testID="profile-snapshot-header-label">
          {page.label}
        </AppText>
      </View>
      <AppText variant="micro" colour="textTertiary">
        {index + 1} / {count}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minWidth: 0,
    width: '100%',
  },
})
