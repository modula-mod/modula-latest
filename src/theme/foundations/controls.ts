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
  actionButton: {
    compact: 32,
    regular: 36,
    prominent: 42,
  },
  iconButton: {
    compact: 32,
    regular: 36,
    navigation: 38,
    floating: 44,
    prominent: 48,
  },
  inputHeight: {
    search: 44,
    singleLine: 46,
    multilineMinimum: 120,
  },
  listRow: {
    minimum: 52,
    compact: 44,
    comfortable: 60,
  },
  toolbar: {
    minimum: 44,
    floating: 48,
  },
  sheet: {
    handleWidth: 36,
    handleHeight: 4,
    compactFraction: 0.36,
    mediumFraction: 0.56,
    largeFraction: 0.92,
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
