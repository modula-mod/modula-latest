import {useContext, useEffect, useState} from 'react'
import {AccessibilityInfo} from 'react-native'

import {AppearanceStateContext} from '@/theme/runtime/AppearanceStateContext'

function useSystemReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (mounted) setReduceMotion(value)
      })
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    )
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return reduceMotion
}

/**
 * Resolved Reduce Motion: Modula override, then the operating-system setting.
 */
export function useReduceMotion(): boolean {
  const appearance = useContext(AppearanceStateContext)
  const systemReduceMotion = useSystemReduceMotion()
  return appearance?.resolved.accessibility.reduceMotion ?? systemReduceMotion
}
