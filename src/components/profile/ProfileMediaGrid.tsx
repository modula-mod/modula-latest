import {StyleSheet, View} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProfileMediaGrid({items}: {items: {id: string; colour?: string}[]}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={[styles.grid, {gap: spacing[2]}]}>
      {items.map(item => (
        <View
          key={item.id}
          style={[
            styles.tile,
            {
              backgroundColor: item.colour ?? colours.surface3,
              borderRadius: radius.medium,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    aspectRatio: 1,
    width: '31.8%',
  },
})
