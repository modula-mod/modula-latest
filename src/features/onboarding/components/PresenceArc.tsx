import {useEffect} from 'react'
import {StyleSheet, View} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type PresenceArcItem = {
  id: string
  label: string
  icon: AppIconName
  unread?: boolean
}

type PresenceArcProps = {
  items: PresenceArcItem[]
  centreLabel?: string
}

function ArcNode({
  item,
  index,
  centreIndex,
  reduceMotion,
}: {
  item: PresenceArcItem
  index: number
  centreIndex: number
  reduceMotion: boolean
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const distance = index - centreIndex
  const isCentre = distance === 0
  const scale = useSharedValue(reduceMotion ? 1 : 0.72)
  const lift = useSharedValue(reduceMotion ? 0 : 10)

  useEffect(() => {
    if (reduceMotion) {
      scale.value = isCentre ? 1.12 : 0.88
      lift.value = isCentre ? -8 : Math.abs(distance) * 6
      return
    }
    scale.value = withDelay(
      index * 40,
      withSpring(isCentre ? 1.14 : 0.86, {damping: 16, stiffness: 180}),
    )
    lift.value = withDelay(
      index * 40,
      withSpring(isCentre ? -10 : Math.abs(distance) * 7, {damping: 16, stiffness: 180}),
    )
  }, [distance, index, isCentre, lift, reduceMotion, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: lift.value}, {scale: scale.value}],
  }))

  return (
    <Animated.View style={[styles.node, animatedStyle, {marginHorizontal: spacing[1]}]}>
      <View
        style={[
          styles.ring,
          {
            borderColor: item.unread ? colours.accent : colours.border,
            borderWidth: item.unread ? 2.5 : StyleSheet.hairlineWidth,
            borderRadius: radius.round,
            backgroundColor: colours.surface,
          },
          isCentre ? styles.ringCentre : null,
        ]}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colours.accentSubtle,
              borderRadius: radius.round,
            },
            isCentre ? styles.avatarCentre : null,
          ]}>
          <AppIcon name={item.icon} colour={colours.accent} size={isCentre ? 26 : 18} />
        </View>
      </View>
      <AppText
        variant="micro"
        colour={isCentre ? 'text' : 'textSecondary'}
        numberOfLines={1}
        style={styles.label}>
        {item.label}
      </AppText>
    </Animated.View>
  )
}

/**
 * Centre-weighted presence rail — modules / Focus, not Instagram Stories.
 */
export function PresenceArc({items, centreLabel}: PresenceArcProps) {
  const {spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const centreIndex = Math.floor(items.length / 2)

  return (
    <View style={[styles.wrap, {gap: spacing[3]}]}>
      <View style={styles.row}>
        {items.map((item, index) => (
          <ArcNode
            key={item.id}
            item={item}
            index={index}
            centreIndex={centreIndex}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>
      {centreLabel ? (
        <View style={styles.centreAction}>
          <AppText variant="label">{centreLabel}</AppText>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: '100%',
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 120,
    width: '100%',
  },
  node: {
    alignItems: 'center',
    maxWidth: 72,
    width: 64,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  ringCentre: {
    padding: 4,
  },
  avatar: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarCentre: {
    height: 64,
    width: 64,
  },
  label: {
    marginTop: 6,
    textAlign: 'center',
    width: '100%',
  },
  centreAction: {
    alignItems: 'center',
  },
})
