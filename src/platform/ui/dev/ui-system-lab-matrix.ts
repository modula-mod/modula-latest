export const UI_SYSTEM_LAB_MATRIX = {
  colour: ['light', 'dark', 'oled'],
  surface: ['native', 'solid', 'glass', 'glay', 'minimalSpatial'],
  text: ['default', 'large'],
  contrast: ['normal', 'increased'],
  transparency: ['normal', 'reduced'],
  motion: ['normal', 'reduced'],
} as const

export type UiSystemLabMatrix = typeof UI_SYSTEM_LAB_MATRIX
