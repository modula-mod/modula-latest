import {useEffect, useState} from 'react'
import {AccessibilityInfo} from 'react-native'

import type {SystemAccessibilityState} from '@/theme/contracts'
import {DEFAULT_SYSTEM_ACCESSIBILITY} from '@/theme/data/defaults'

async function readSystemAccessibility(): Promise<SystemAccessibilityState> {
  const [
    boldText,
    reduceMotion,
    reduceTransparency,
    screenReaderEnabled,
    grayscaleEnabled,
    invertColoursEnabled,
    highTextContrast,
    darkerSystemColors,
  ] = await Promise.all([
    AccessibilityInfo.isBoldTextEnabled().catch(() => false),
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    AccessibilityInfo.isReduceTransparencyEnabled().catch(() => false),
    AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
    AccessibilityInfo.isGrayscaleEnabled().catch(() => false),
    AccessibilityInfo.isInvertColorsEnabled().catch(() => false),
    AccessibilityInfo.isHighTextContrastEnabled().catch(() => false),
    AccessibilityInfo.isDarkerSystemColorsEnabled().catch(() => false),
  ])

  return {
    boldText,
    reduceMotion,
    reduceTransparency,
    screenReaderEnabled,
    grayscaleEnabled,
    invertColoursEnabled,
    increaseContrast: highTextContrast || darkerSystemColors,
    differentiateWithoutColor: false,
  }
}

export function useSystemAccessibility(): SystemAccessibilityState {
  const [state, setState] = useState<SystemAccessibilityState>(
    DEFAULT_SYSTEM_ACCESSIBILITY,
  )

  useEffect(() => {
    let mounted = true

    readSystemAccessibility()
      .then(next => {
        if (mounted) {
          setState(next)
        }
      })
      .catch(error => {
        if (__DEV__) {
          console.warn('Failed to read system accessibility settings', error)
        }
      })

    const subscriptions = [
      AccessibilityInfo.addEventListener('boldTextChanged', boldText =>
        setState(prev => ({...prev, boldText})),
      ),
      AccessibilityInfo.addEventListener('reduceMotionChanged', reduceMotion =>
        setState(prev => ({...prev, reduceMotion})),
      ),
      AccessibilityInfo.addEventListener(
        'reduceTransparencyChanged',
        reduceTransparency => setState(prev => ({...prev, reduceTransparency})),
      ),
      AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        screenReaderEnabled => setState(prev => ({...prev, screenReaderEnabled})),
      ),
      AccessibilityInfo.addEventListener('grayscaleChanged', grayscaleEnabled =>
        setState(prev => ({...prev, grayscaleEnabled})),
      ),
      AccessibilityInfo.addEventListener(
        'invertColorsChanged',
        invertColoursEnabled => setState(prev => ({...prev, invertColoursEnabled})),
      ),
      AccessibilityInfo.addEventListener('highTextContrastChanged', enabled =>
        setState(prev => ({
          ...prev,
          increaseContrast: enabled || prev.increaseContrast,
        })),
      ),
      AccessibilityInfo.addEventListener('darkerSystemColorsChanged', enabled =>
        setState(prev => ({
          ...prev,
          increaseContrast: enabled || prev.increaseContrast,
        })),
      ),
    ]

    return () => {
      mounted = false
      subscriptions.forEach(subscription => subscription.remove())
    }
  }, [])

  return state
}
