import {View} from 'react-native'

import {KonstaSegmentedControl} from '@/platform/ui/adapters/konsta/segmented-control.web'
import {ModulaSegmentedPicker as SharedModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker.shared'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/** Konsta-backed mutually-exclusive control on web; scrolling/plain tabs stay semantic RN. */
export function ModulaSegmentedPicker({
  appearance = 'segmented',
  embedded = false,
  options,
  scrollable = false,
  style,
  ...props
}: ModulaSegmentedPickerProps) {
  if (appearance === 'plain' || scrollable || embedded) {
    return (
      <SharedModulaSegmentedPicker
        {...props}
        appearance={appearance}
        embedded={embedded}
        options={options}
        scrollable={scrollable}
        style={style}
      />
    )
  }
  return (
    <View style={[{alignSelf: 'stretch', minHeight: 44, justifyContent: 'center'}, style]}>
      <KonstaSegmentedControl options={options} {...props} />
    </View>
  )
}
