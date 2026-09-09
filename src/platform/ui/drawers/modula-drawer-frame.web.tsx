import {Dialog} from '@base-ui/react/dialog'
import {useMemo, type ReactNode} from 'react'
import {Pressable, StyleSheet} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import Animated, {interpolate, runOnJS, useAnimatedStyle, type SharedValue} from 'react-native-reanimated'

import {useReduceMotion} from '@/lib/accessibility'
import {KonstaOverlaySurface} from '@/platform/ui/adapters/konsta/overlay-surfaces.web'
import {
  ModulaOverlayLayerScope,
  useModulaOverlayLayer,
} from '@/platform/ui/overlays/modula-overlay-stack'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaDrawerFrameProps = {
  isPresented: boolean
  progress: SharedValue<number>
  width: number
  onDismiss: () => void
  onSettle: (options: {velocityX: number; at: number}) => void
  children: ReactNode
  side?: 'leading' | 'trailing'
  accessibilityLabel?: string
  testID?: string
}

/**
 * Web navigation panel. Base UI exclusively owns the modal/focus/portal/
 * Escape/scroll-lock lifecycle, Modula Reanimated owns the pan animation, and
 * Konsta Panel exclusively supplies the Liquid/Material visual surface.
 */
export function ModulaDrawerFrame({
  accessibilityLabel = 'Navigation drawer',
  children,
  isPresented,
  onDismiss,
  onSettle,
  progress,
  side = 'leading',
  testID,
  width,
}: ModulaDrawerFrameProps) {
  const {colours} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const layer = useModulaOverlayLayer('drawer')
  const direction = side === 'leading' ? -1 : 1
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }))
  const drawerStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? interpolate(progress.value, [0, 1], [0, 1])
      : interpolate(progress.value, [0, 0.2, 1], [0.85, 1, 1]),
    transform: reduceMotion
      ? []
      : [
          {translateX: interpolate(progress.value, [0, 1], [direction * width, 0])},
          {scale: interpolate(progress.value, [0, 1], [0.97, 1])},
        ],
  }))
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-24, 24])
        .onUpdate(event => {
          'worklet'
          const travel = side === 'leading' ? event.translationX : -event.translationX
          // eslint-disable-next-line react-hooks/immutability
          progress.value = Math.max(0, Math.min(1, 1 + travel / width))
        })
        .onEnd(event => {
          'worklet'
          runOnJS(onSettle)({
            velocityX: side === 'leading' ? event.velocityX : -event.velocityX,
            at: progress.value,
          })
        }),
    [onSettle, progress, side, width],
  )

  return (
    <Dialog.Root open={isPresented} onOpenChange={open => { if (!open) onDismiss() }} modal>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="modula-web-ui modula-web-backdrop modula-web-navigation-panel-backdrop"
          style={{zIndex: layer.backdrop}}>
          <Animated.View style={[StyleSheet.absoluteFill, {backgroundColor: colours.backdrop}, backdropStyle]}>
            <Pressable
              accessibilityLabel="Close drawer"
              accessibilityRole="button"
              onPress={onDismiss}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Dialog.Backdrop>
        <Dialog.Viewport
          className="modula-web-ui modula-web-drawer-viewport"
          data-direction={side === 'leading' ? 'left' : 'right'}
          style={{zIndex: layer.content}}>
          <Dialog.Popup
            aria-label={accessibilityLabel}
            className="modula-web-navigation-panel-host"
            data-side={side === 'leading' ? 'left' : 'right'}
            data-testid={testID}
            finalFocus
            initialFocus
            style={{width}}>
            <Dialog.Title className="modula-web-visually-hidden">{accessibilityLabel}</Dialog.Title>
            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.animatedPanel, drawerStyle]}>
                <KonstaOverlaySurface
                  floating
                  kind="panel"
                  side={side === 'leading' ? 'left' : 'right'}>
                  <ModulaOverlayLayerScope layer={layer.content}>
                    {children}
                  </ModulaOverlayLayerScope>
                </KonstaOverlaySurface>
              </Animated.View>
            </GestureDetector>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const styles = StyleSheet.create({
  animatedPanel: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
})
