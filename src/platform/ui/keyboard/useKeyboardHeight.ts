import {useEffect, useState} from 'react'
import {Keyboard, type KeyboardEvent, Platform} from 'react-native'

/**
 * Tracks soft-keyboard height for sheet/composer chrome that must stay
 * above the keyboard without stacking custom tab-bar offsets.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (event: KeyboardEvent) => {
      setHeight(event.endCoordinates?.height ?? 0)
    }
    const onHide = () => setHeight(0)

    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return height
}
