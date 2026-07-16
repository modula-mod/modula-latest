import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const errors = []

const paletteKeys = [
  'canvas',
  'surface1',
  'surface2',
  'surface3',
  'border',
  'borderStrong',
  'textMain',
  'textSub',
  'textMuted',
]

const modes = ['light', 'dim', 'dark', 'oled']
const families = ['standard', 'forest', 'ocean', 'plum', 'espresso', 'spaceGray']
const accents = [
  'modulaTeal',
  'electricCyan',
  'vividViolet',
  'neonMint',
  'sunsetOrange',
  'crimsonFlash',
  'lemonSpark',
  'rosePetal',
]

function fail(message) {
  errors.push(message)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
}

function isHex(value) {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value)
}

function channel(value) {
  const next = value / 255
  return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const value = hex.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(first, second) {
  const a = luminance(first)
  const b = luminance(second)
  const light = Math.max(a, b)
  const dark = Math.min(a, b)
  return (light + 0.05) / (dark + 0.05)
}

function strongestForeground(hex) {
  return contrast(hex, '#000000') >= contrast(hex, '#FFFFFF')
    ? '#000000'
    : '#FFFFFF'
}

const palettes = readJson('src/theme/data/palettes.json')
const accentData = readJson('src/theme/data/accents.json')

for (const family of families) {
  if (!palettes[family]) fail(`Missing theme family: ${family}`)
}

for (const mode of modes) {
  if (!palettes.standard?.[mode]) fail(`Missing standard ${mode} palette`)
}

for (const family of families.filter(family => family !== 'standard')) {
  for (const mode of ['dim', 'dark', 'oled']) {
    if (!palettes[family]?.[mode]) fail(`Missing ${family} ${mode} palette`)
  }
}

const seen = new Map()
for (const [family, modeMap] of Object.entries(palettes)) {
  for (const [mode, palette] of Object.entries(modeMap)) {
    const id = `${family}.${mode}`
    for (const key of paletteKeys) {
      if (!Object.prototype.hasOwnProperty.call(palette, key)) {
        fail(`${id} missing key ${key}`)
      } else if (!isHex(palette[key])) {
        fail(`${id}.${key} must be #RRGGBB`)
      }
      if (typeof palette[key] === 'string' && /TODO|PLACEHOLDER|TOKEN/i.test(palette[key])) {
        fail(`${id}.${key} contains unresolved placeholder text`)
      }
    }

    if (mode === 'oled' && palette.canvas !== '#000000') {
      fail(`${id}.canvas must be exactly #000000`)
    }

    if (isHex(palette.canvas) && isHex(palette.textMain)) {
      const ratio = contrast(palette.canvas, palette.textMain)
      if (ratio < 7) fail(`${id}.textMain contrast is ${ratio.toFixed(2)}:1`)
    }
    if (isHex(palette.canvas) && isHex(palette.textSub)) {
      const ratio = contrast(palette.canvas, palette.textSub)
      if (ratio < 4.5) fail(`${id}.textSub contrast is ${ratio.toFixed(2)}:1`)
    }
    if (isHex(palette.canvas) && isHex(palette.textMuted)) {
      const ratio = contrast(palette.canvas, palette.textMuted)
      if (ratio < 3) fail(`${id}.textMuted contrast is ${ratio.toFixed(2)}:1`)
    }

    const signature = JSON.stringify(palette)
    if (seen.has(signature)) {
      fail(`Duplicate palette object: ${id} duplicates ${seen.get(signature)}`)
    }
    seen.set(signature, id)
  }
}

for (const accent of accents) {
  const data = accentData[accent]
  if (!data) {
    fail(`Missing accent preset: ${accent}`)
    continue
  }
  if (!data.label) fail(`Accent ${accent} missing label`)
  if (!isHex(data.base)) fail(`Accent ${accent} base must be #RRGGBB`)
  if (isHex(data.base)) {
    const foreground = strongestForeground(data.base)
    const ratio = contrast(data.base, foreground)
    if (ratio < 4.5) {
      fail(`Accent ${accent} foreground contrast is ${ratio.toFixed(2)}:1`)
    }
  }
}

if (errors.length) {
  console.error('Theme contrast verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Theme contrast verification passed.')
