import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type ProfileTabsProps<T extends string> = {
  tabs: readonly T[]
  value: T
  onChange: (tab: T) => void
}

export function ProfileTabs<T extends string>({
  tabs,
  value,
  onChange,
}: ProfileTabsProps<T>) {
  const {colours, spacing} = useTheme()

  return (
    <View style={[styles.tabs, {borderBottomColor: colours.border}]}>
      {tabs.map(item => (
        <AppPressable
          key={item}
          onPress={() => onChange(item)}
          style={[
            styles.tab,
            {
              borderBottomColor: value === item ? colours.accent : 'transparent',
              paddingVertical: spacing.sm,
            },
          ]}>
          <AppText
            variant="label"
            colour={value === item ? 'accent' : 'textSecondary'}>
            {item}
          </AppText>
        </AppPressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
})
