import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {LayoutChangeEvent, StyleSheet, View} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import Svg, {Line} from 'react-native-svg'
import Ionicons from '@expo/vector-icons/Ionicons'
import {runOnJS} from 'react-native-reanimated'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {patternToCredential} from '@/features/security/app-lock/app-lock-storage'
import {useAppLock} from '@/features/security/app-lock/app-lock-context'
import {
  APP_LOCK_ACCENT,
  PATTERN_MIN_NODES,
} from '@/features/security/app-lock/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const NODE_COUNT = 9
const GRID = 3

type Props = {
  mode?: 'unlock' | 'setup'
  onSetupComplete?: (pattern: string) => void
  onSwitchMethod?: () => void
  title?: string
  subtitle?: string
}

function indexAtPoint(
  x: number,
  y: number,
  size: number,
  hitRadius: number,
): number | null {
  const cell = size / GRID
  for (let i = 0; i < NODE_COUNT; i += 1) {
    const col = i % GRID
    const row = Math.floor(i / GRID)
    const cx = cell * col + cell / 2
    const cy = cell * row + cell / 2
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return i
  }
  return null
}

export function UnlockPatternScreen({
  mode = 'unlock',
  onSetupComplete,
  onSwitchMethod,
  title = 'Draw Pattern',
  subtitle = 'Use your local pattern to continue',
}: Props) {
  const {colours, spacing} = useThemeTokens()
  const insets = useSafeAreaInsets()
  const {unlockWithCredential, config, biometricUnlock} = useAppLock()
  const [size, setSize] = useState(280)
  const [path, setPath] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const nodes = useMemo(() => {
    const cell = size / GRID
    return Array.from({length: NODE_COUNT}).map((_, i) => ({
      i,
      x: cell * (i % GRID) + cell / 2,
      y: cell * Math.floor(i / GRID) + cell / 2,
    }))
  }, [size])

  const finish = useCallback(
    async (nodesPath: number[]) => {
      if (nodesPath.length < PATTERN_MIN_NODES) {
        setError(`Connect at least ${PATTERN_MIN_NODES} dots`)
        setPath([])
        return
      }
      const credential = patternToCredential(nodesPath)
      if (mode === 'setup') {
        onSetupComplete?.(credential)
        setPath([])
        return
      }
      const result = await unlockWithCredential('pattern', credential)
      if (!result.ok) {
        setError(result.message ?? 'Incorrect pattern')
      }
      setPath([])
    },
    [mode, onSetupComplete, unlockWithCredential],
  )

  const pathLatest = useRef(path)
  useEffect(() => {
    pathLatest.current = path
  }, [path])

  const addNode = useCallback((index: number) => {
    setPath(prev => (prev.includes(index) ? prev : [...prev, index]))
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const completePattern = useCallback(() => {
    void finish(pathLatest.current)
  }, [finish])

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.min(e.nativeEvent.layout.width, 320)
    setSize(w)
  }

  /* eslint-disable react-hooks/refs -- Gesture.Pan callbacks fire as event handlers, not during render */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(e => {
          runOnJS(clearError)()
          const hit = indexAtPoint(e.x, e.y, size, size / GRID / 2.4)
          if (hit != null) runOnJS(addNode)(hit)
        })
        .onUpdate(e => {
          const hit = indexAtPoint(e.x, e.y, size, size / GRID / 2.4)
          if (hit != null) runOnJS(addNode)(hit)
        })
        .onEnd(() => {
          runOnJS(completePattern)()
        }),
    [addNode, clearError, completePattern, size],
  )
  /* eslint-enable react-hooks/refs */

  const hasBiometric = config.configuredMethods.includes('biometric')

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colours.canvas,
          paddingTop: insets.top + spacing[8],
          paddingBottom: insets.bottom + spacing[6],
          paddingHorizontal: spacing[5],
          gap: spacing[5],
        },
      ]}>
      <View style={styles.header}>
        <Ionicons name="git-network-outline" size={36} color={APP_LOCK_ACCENT} />
        <AppText variant="headline" style={styles.center}>
          {title}
        </AppText>
        <AppText variant="caption" colour="textSecondary" style={styles.center}>
          {subtitle}
        </AppText>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={[styles.grid, {width: size, height: size}]} onLayout={onLayout}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            {path.map((node, i) => {
              if (i === 0) return null
              const a = nodes[path[i - 1]!]
              const b = nodes[node]
              if (!a || !b) return null
              return (
                <Line
                  key={`l-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={APP_LOCK_ACCENT}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              )
            })}
          </Svg>
          {nodes.map(node => {
            const active = path.includes(node.i)
            return (
              <View
                key={node.i}
                pointerEvents="none"
                style={[
                  styles.node,
                  {
                    left: node.x - 14,
                    top: node.y - 14,
                    borderColor: active ? APP_LOCK_ACCENT : colours.border,
                    backgroundColor: active ? APP_LOCK_ACCENT : colours.surfaceRaised,
                  },
                ]}
              />
            )
          })}
        </View>
      </GestureDetector>

      {error ? (
        <AppText variant="caption" style={{color: colours.destructive, textAlign: 'center'}}>
          {error}
        </AppText>
      ) : null}

      {mode === 'unlock' && hasBiometric ? (
        <AppPressable
          onPress={() => void biometricUnlock()}
          style={styles.alt}
          accessibilityLabel="Use Biometric">
          <AppText variant="caption" colour="textSecondary">
            Use Biometric
          </AppText>
        </AppPressable>
      ) : onSwitchMethod ? (
        <AppPressable onPress={onSwitchMethod} style={styles.alt}>
          <AppText variant="caption" colour="textSecondary">
            Use another method
          </AppText>
        </AppPressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {flex: 1, alignItems: 'center'},
  header: {alignItems: 'center', gap: 8},
  center: {textAlign: 'center'},
  grid: {alignSelf: 'center'},
  node: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  alt: {alignSelf: 'center'},
})
