/** Raw colour values. Prefer semantic tokens in UI. */
export const colour = {
  brandAccent: '#369CAA',
  white: '#FFFFFF',
  black: '#000000',
  neutral50: '#FAFAFA',
  neutral100: '#F4F4F5',
  neutral200: '#E4E4E7',
  neutral300: '#D4D4D8',
  neutral500: '#71717A',
  neutral700: '#3F3F46',
  neutral900: '#18181B',
  red600: '#DC2626',
} as const

export type ColourName = keyof typeof colour
