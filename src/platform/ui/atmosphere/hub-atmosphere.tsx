import {StyleSheet, View, useWindowDimensions} from 'react-native'
import Svg, {Path, Rect} from 'react-native-svg'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Compact catalogue masthead for Product Hub landing.
 * Paper/ink drawing — not a teal wash and not a second featured hero.
 */
export function HubAtmosphere() {
  const {colours} = useThemeTokens()
  const {width} = useWindowDimensions()
  const paper = colours.surface
  const ink = colours.text
  const wash = colours.surfaceRaised
  const stitch = colours.textSecondary
  return (
    <View style={[styles.frame, {backgroundColor: wash}]} accessibilityLabel="Product Hub artwork">
      <Svg width={width} height={88} viewBox="0 0 390 88" preserveAspectRatio="xMidYMid slice">
        <Rect width="390" height="88" fill={wash} />
        <Path
          d="M24 10 H152 C160 10 166 16 166 24 V78 C166 84 160 86 152 86 H40 C32 86 24 80 24 72 V26 L42 10 Z"
          fill={paper}
        />
        <Path d="M24 26 H42 V10" fill="none" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <Path d="M50 32 H140" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M50 46 H128" stroke={ink} strokeWidth="1.3" opacity="0.45" strokeLinecap="round" />
        <Path d="M50 60 H136" stroke={ink} strokeWidth="1.3" opacity="0.28" strokeLinecap="round" />
        <Path
          d="M118 70 C118 62 130 60 134 68 C138 78 118 78 118 86"
          stroke={stitch}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <Rect x="214" y="14" width="148" height="62" rx="8" fill={wash} stroke={ink} strokeWidth="1" opacity="0.4" />
        <Path d="M232 32 H342" stroke={ink} strokeWidth="1.1" opacity="0.2" strokeLinecap="round" />
        <Path d="M232 46 H318" stroke={ink} strokeWidth="1.1" opacity="0.12" strokeLinecap="round" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    height: 88,
    overflow: 'hidden',
    width: '100%',
  },
})
