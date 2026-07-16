import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'

export type ProfileStat = {
  label: string
  value: number | string
}

export function ProfileStats({stats}: {stats: ProfileStat[]}) {
  return (
    <View style={styles.wrap}>
      {stats.map(stat => (
        <View key={stat.label} style={styles.stat}>
          <AppText variant="headline">{stat.value}</AppText>
          <AppText variant="caption" colour="textSub">
            {stat.label}
          </AppText>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
  },
  wrap: {
    flexDirection: 'row',
  },
})
