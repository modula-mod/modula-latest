import {StyleSheet, View, useWindowDimensions} from 'react-native'
import Svg, {Path, Rect} from 'react-native-svg'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Quiet profile cover when there is no photograph.
 * Paper/ink drawing — never a teal wash for every account.
 */
export function CoverAtmosphere({
  ink,
  paper,
  wash,
}: {
  ink?: string
  paper?: string
  wash?: string
}) {
  const {colours} = useThemeTokens()
  const {width} = useWindowDimensions()
  const sceneInk = ink ?? colours.text
  const scenePaper = paper ?? colours.surface
  const sceneWash = wash ?? colours.surfaceRaised
  return (
    <View style={[styles.fill, {backgroundColor: sceneWash}]} pointerEvents="none">
      <Svg width={width} height={220} viewBox="0 0 390 220" preserveAspectRatio="xMidYMid slice">
        <Rect width="390" height="220" fill={sceneWash} />
        <Path d="M0 148 C90 120 180 170 390 132 L390 220 L0 220 Z" fill={scenePaper} opacity="0.55" />
        <Path
          d="M48 36 H210 C220 36 228 44 228 54 V168 C228 178 220 186 210 186 H64 C54 186 48 178 48 168 V56 L68 36 Z"
          fill={scenePaper}
        />
        <Path d="M48 56 H68 V36" fill="none" stroke={sceneInk} strokeWidth="1.4" strokeLinejoin="round" />
        <Path d="M84 78 H196" stroke={sceneInk} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M84 98 H176" stroke={sceneInk} strokeWidth="1.5" opacity="0.45" strokeLinecap="round" />
        <Path d="M84 118 H188" stroke={sceneInk} strokeWidth="1.5" opacity="0.28" strokeLinecap="round" />
        <Path d="M260 52 H360" stroke={sceneInk} strokeWidth="1.3" opacity="0.18" strokeLinecap="round" />
        <Path d="M260 72 H340" stroke={sceneInk} strokeWidth="1.3" opacity="0.12" strokeLinecap="round" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
