import {useEffect, useState} from 'react'
import {AccessibilityInfo} from 'react-native'

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value)
    })
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
