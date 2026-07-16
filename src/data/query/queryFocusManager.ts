import {AppState, Platform} from 'react-native'
import {focusManager} from '@tanstack/react-query'

export function installQueryFocusManager(): () => void {
  if (Platform.OS === 'web') return () => undefined
  const subscription = AppState.addEventListener('change', state => {
    focusManager.setFocused(state === 'active')
  })
  focusManager.setFocused(AppState.currentState === 'active')
  return () => subscription.remove()
}
