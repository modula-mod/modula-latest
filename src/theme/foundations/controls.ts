/**
 * Canonical shell control geometry.
 *
 * Visible size and touch size are deliberately separate. A compact control may
 * paint at 34–38pt while its pressable wrapper remains at least 44pt.
 */
export const controls = {
  touchTarget: {
    minimum: 44,
  },
  controlHeight: {
    compact: 34,
    regular: 42,
    prominent: 46,
  },
  iconButton: {
    compact: 32,
    regular: 36,
    navigation: 38,
  },
  inputHeight: {
    search: 44,
    singleLine: 46,
    multilineMinimum: 120,
  },
  listRow: {
    minimum: 52,
  },
  iconSize: {
    status: 16,
    row: 20,
    toolbar: 20,
  },
  iconTile: {
    small: 30,
  },
} as const

export type ControlTokens = typeof controls
