export type Rgb = {
  r: number
  g: number
  b: number
}

export function expandHexColour(input: string): string | null {
  const trimmed = input.trim()
  const short = /^#([0-9a-fA-F]{3})$/.exec(trimmed)
  if (short) {
    return `#${short[1]
      .split('')
      .map(char => `${char}${char}`)
      .join('')
      .toUpperCase()}`
  }

  const long = /^#([0-9a-fA-F]{6})$/.exec(trimmed)
  return long ? `#${long[1].toUpperCase()}` : null
}

export function isValidHexColour(input: unknown): input is string {
  return typeof input === 'string' && expandHexColour(input) !== null
}

export function hexToRgb(hex: string): Rgb {
  const normalized = expandHexColour(hex)
  if (!normalized) {
    throw new Error(`Invalid hex colour: ${hex}`)
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

export function rgbToHex({r, g, b}: Rgb): string {
  return `#${[r, g, b]
    .map(channel =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`
}

export function mixHex(from: string, to: string, amount: number): string {
  const start = hexToRgb(from)
  const end = hexToRgb(to)
  const weight = Math.max(0, Math.min(1, amount))

  return rgbToHex({
    r: start.r + (end.r - start.r) * weight,
    g: start.g + (end.g - start.g) * weight,
    b: start.b + (end.b - start.b) * weight,
  })
}

function luminanceChannel(channel: number): number {
  const normalized = channel / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(hex: string): number {
  const {r, g, b} = hexToRgb(hex)
  return (
    0.2126 * luminanceChannel(r) +
    0.7152 * luminanceChannel(g) +
    0.0722 * luminanceChannel(b)
  )
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const lightest = Math.max(firstLuminance, secondLuminance)
  const darkest = Math.min(firstLuminance, secondLuminance)

  return (lightest + 0.05) / (darkest + 0.05)
}

export function strongestReadableForeground(hex: string): '#000000' | '#FFFFFF' {
  const black = contrastRatio(hex, '#000000')
  const white = contrastRatio(hex, '#FFFFFF')
  return black >= white ? '#000000' : '#FFFFFF'
}
