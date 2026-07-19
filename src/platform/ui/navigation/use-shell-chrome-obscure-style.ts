import {useAnimatedStyle} from 'react-native-reanimated'

import {shellChromeObscureAmount} from '@/platform/ui/navigation/shell-chrome-obscure'

/**
 * Fade + slide shell chrome away while Home pull stage / refresh / search is active.
 */
export function useShellChromeObscureStyle(
  direction: 'up' | 'down' = 'down',
) {
  return useAnimatedStyle(() => {
    const o = shellChromeObscureAmount()
    return {
      opacity: 1 - o,
      transform: [
        {
          translateY: direction === 'down' ? o * 88 : -o * 36,
        },
        {
          scale: 1 - o * 0.04,
        },
      ],
    }
  })
}
