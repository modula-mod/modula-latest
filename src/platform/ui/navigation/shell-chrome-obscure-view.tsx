import {useState, type ReactNode} from 'react'
import Animated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated'

import {shellChromeObscureAmount} from '@/platform/ui/navigation/shell-chrome-obscure'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'

type Props = {
  direction?: 'up' | 'down'
  children: ReactNode
}

/**
 * Fades / slides chrome away while Home pull / refresh / search is active.
 */
export function ShellChromeObscureView({
  direction = 'down',
  children,
}: Props) {
  const obscureStyle = useShellChromeObscureStyle(direction)
  const [interactive, setInteractive] = useState(true)

  useAnimatedReaction(
    () => shellChromeObscureAmount(),
    value => {
      runOnJS(setInteractive)(value < 0.25)
    },
    [],
  )

  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={obscureStyle}>
      {children}
    </Animated.View>
  )
}
