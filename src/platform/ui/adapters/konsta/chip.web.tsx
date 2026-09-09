import {Chip} from 'konsta/react'
import type {ReactNode} from 'react'

export function KonstaChip({
  disabled,
  label,
  media,
  onPress,
  selected,
  testID,
}: {
  disabled?: boolean
  label: string
  media?: ReactNode
  onPress: () => void
  selected: boolean
  testID?: string
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className="modula-konsta-chip-target"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      type="button">
      <Chip
        className="modula-konsta-chip"
        media={media}
        outline={!selected}>
        {label}
      </Chip>
    </button>
  )
}
