import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'

export type ProductHubSegment = 'discover' | 'installed' | 'updates'

const OPTIONS: {value: ProductHubSegment; label: string}[] = [
  {value: 'discover', label: 'Discover'},
  {value: 'installed', label: 'Installed'},
  {value: 'updates', label: 'Updates'},
]

/**
 * Canonical Product Hub segmented control.
 * iOS uses the native Expo UI segmented Picker; Android/web use the shared track.
 */
export function ProductHubSegmentedControl({
  value,
  onChange,
  updatesDisabled = false,
}: {
  value: ProductHubSegment
  onChange: (value: ProductHubSegment) => void
  updatesDisabled?: boolean
}) {
  return (
    <ModulaSegmentedPicker
      appearance="segmented"
      accessibilityLabel="Product Hub sections"
      testID="product-hub-segmented"
      value={value}
      onValueChange={next => onChange(next as ProductHubSegment)}
      options={OPTIONS.map(option =>
        option.value === 'updates' ? {...option, disabled: updatesDisabled} : option,
      )}
    />
  )
}
