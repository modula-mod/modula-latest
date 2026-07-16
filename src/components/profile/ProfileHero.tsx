import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileHeroProps = {
  name: string
  avatarColour?: string
  avatar?: ReactNode
  children: ReactNode
}

export function ProfileHero({name, avatarColour, avatar, children}: ProfileHeroProps) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View>
      <View
        style={[
          styles.cover,
          {backgroundColor: colours.accentSubtle, borderBottomColor: colours.border},
        ]}>
        <View
          style={[
            styles.coverGlow,
            {backgroundColor: avatarColour ?? colours.accent, borderRadius: radius.xlarge},
          ]}
        />
      </View>
      <View style={[styles.block, {gap: spacing[4], padding: spacing[4]}]}>
        <View
          style={[
            styles.avatarWrap,
            {borderColor: colours.canvas, backgroundColor: colours.accent},
          ]}>
          {avatar ?? <Avatar name={name} colour={avatarColour} size={84} />}
        </View>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  avatarWrap: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 4,
    height: 92,
    justifyContent: 'center',
    marginTop: -58,
    width: 92,
  },
  block: {},
  cover: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 150,
    overflow: 'hidden',
  },
  coverGlow: {
    height: 170,
    opacity: 0.18,
    position: 'absolute',
    right: -60,
    top: 32,
    width: 220,
  },
})
