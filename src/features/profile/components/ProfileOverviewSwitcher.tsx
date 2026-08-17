import {Pressable, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ProfileOverviewPage} from '@/features/profile/model/profile-snapshot'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const SWITCHER: {id: ProfileOverviewPage; label: string}[] = [
  {id: 'metrics', label: 'Metrics'},
  {id: 'about', label: 'About'},
]

type ProfileOverviewSwitcherProps = {
  selected: ProfileOverviewPage
  onSelect: (page: ProfileOverviewPage) => void
}

/**
 * Inner Overview switcher. Underline tabs — not the numbered outer pager.
 */
export function ProfileOverviewSwitcher({selected, onSelect}: ProfileOverviewSwitcherProps) {
  const {colours} = useThemeTokens()

  return (
    <View style={styles.row} testID="profile-overview-switcher">
      {SWITCHER.map(item => {
        const active = item.id === selected
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{selected: active}}
            testID={`profile-overview-switcher-${item.id}`}
            hitSlop={8}
            onPress={() => onSelect(item.id)}
            style={styles.hit}>
            <AppText
              variant="label"
              colour={active ? 'text' : 'textTertiary'}
              numberOfLines={1}>
              {item.label}
            </AppText>
            <View
              style={[
                styles.rule,
                {backgroundColor: active ? colours.accent : 'transparent'},
              ]}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  hit: {
    justifyContent: 'flex-end',
    minHeight: 32,
    paddingRight: 20,
    paddingTop: 2,
  },
  row: {
    flexDirection: 'row',
    minWidth: 0,
  },
  rule: {
    borderRadius: 1,
    height: 2,
    marginTop: 4,
  },
})
