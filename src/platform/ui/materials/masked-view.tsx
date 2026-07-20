import type {ReactElement, ReactNode} from 'react'
import {View, type StyleProp, type ViewProps, type ViewStyle} from 'react-native'

type MaskedViewProps = ViewProps & {
  maskElement: ReactElement
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * Web / fallback: no alpha mask — children render unmasked.
 * Native uses `@expo/ui/community/masked-view` via masked-view.native.tsx.
 */
export function MaskedView({children, style, ...rest}: MaskedViewProps) {
  return (
    <View {...rest} style={style}>
      {children}
    </View>
  )
}
