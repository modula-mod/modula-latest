import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProfileTabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  const {colours} = useThemeTokens()

  return (
    <View style={[styles.tabs, {borderBottomColor: colours.border}]}>
      {tabs.map(tab => (
        <AppPressable
          key={tab}
          accessibilityLabel={`${tab} tab`}
          accessibilityState={{selected: value === tab}}
          onPress={() => onChange(tab)}
          style={styles.tab}>
          <AppText
            variant="label"
            style={{color: value === tab ? colours.accent : colours.textSub}}>
            {tab}
          </AppText>
          <View
            style={[
              styles.line,
              {backgroundColor: value === tab ? colours.accent : 'transparent'},
            ]}
          />
        </AppPressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  line: {
    height: 2,
    width: '100%',
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  tabs: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
