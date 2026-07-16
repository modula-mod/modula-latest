import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Pill} from '@/components/primitives/Pill'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileIdentityProps = {
  displayName: string
  handle: string
  bio: string
  indicators: string[]
}

export function ProfileIdentity({
  displayName,
  handle,
  bio,
  indicators,
}: ProfileIdentityProps) {
  const {spacing} = useThemeTokens()

  return (
    <View style={{gap: spacing[3]}}>
      <View>
        <AppText variant="display">{displayName}</AppText>
        <AppText variant="body" colour="textSub">
          @{handle}
        </AppText>
      </View>
      <AppText variant="body">{bio}</AppText>
      <View style={[styles.indicators, {gap: spacing[2]}]}>
        {indicators.map(indicator => (
          <Pill key={indicator} label={indicator} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  indicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
