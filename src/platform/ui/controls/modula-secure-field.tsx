import {useState, type ComponentProps} from 'react'
import {Pressable, StyleSheet, View} from 'react-native'

import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ModulaSecureFieldProps = Omit<
  ComponentProps<typeof ModulaTextInput>,
  'secureTextEntry'
> & {
  /** Show the reveal toggle. Defaults to true. */
  allowReveal?: boolean
}

/**
 * Password entry with a labelled show/hide affordance. Builds on the
 * canonical ModulaTextInput adapter — password-manager autofill intact.
 */
export function ModulaSecureField({
  allowReveal = true,
  style,
  ...props
}: ModulaSecureFieldProps) {
  const {colours, spacing} = useThemeTokens()
  const [revealed, setRevealed] = useState(false)

  return (
    <View style={styles.root}>
      <ModulaTextInput
        {...props}
        secureTextEntry={!revealed}
        autoCorrect={props.autoCorrect ?? false}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoComplete={props.autoComplete ?? 'current-password'}
        style={[style, allowReveal ? {paddingRight: spacing[8]} : null]}
      />
      {allowReveal ? (
        <Pressable
          onPress={() => setRevealed(current => !current)}
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          hitSlop={8}
          style={styles.toggle}>
          <ModulaIcon
            name={revealed ? 'eyeOff' : 'eye'}
            size={18}
            colour={colours.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    justifyContent: 'center',
  },
  toggle: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
  },
})
