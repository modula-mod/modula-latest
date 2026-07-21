import {useAnimatedStyle} from 'react-native-reanimated'

import {
  shellChromeHoldObscure,
  shellChromePullObscure,
} from '@/platform/ui/navigation/shell-chrome-obscure'

/**
 * Fade + slide shell chrome away while Home pull stage / refresh / search is active.
 * Reads shared values inline so Reanimated tracks them reliably.
 * Uses a hard slide-off — native liquid-glass often ignores parent opacity alone.
 */
export function useShellChromeObscureStyle(
  direction: 'up' | 'down' = 'down',
) {
  return useAnimatedStyle(() => {
    const pull = shellChromePullObscure.value
    const hold = shellChromeHoldObscure.value
    const o = pull > hold ? pull : hold
    const hidden = o >= 0.98
    return {
      opacity: hidden ? 0 : 1 - o,
      transform: [
        {
          translateY:
            direction === 'down'
              ? o * 160
              : -o * 72,
        },
      ],
    }
  })
}
