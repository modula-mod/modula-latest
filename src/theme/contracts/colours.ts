export type SemanticColours = {
  canvas: string
  surface1: string
  surface2: string
  surface3: string
  surfaceOverlay: string
  border: string
  borderStrong: string
  separator: string
  textMain: string
  textSub: string
  textMuted: string
  textInverse: string
  accent: string
  accentForeground: string
  accentSubtle: string
  accentBorder: string
  accentPressed: string
  destructive: string
  destructiveSubtle: string
  warning: string
  success: string
  info: string
  backdrop: string
  shadow: string
  focusRing: string
  selection: string
  mediaGlowFallback: string
  /** Overlay text/controls on media (Reels, full-bleed images). */
  mediaOverlayText: string
  mediaOverlaySecondary: string
  mediaOverlayIcon: string
  mediaOverlayScrim: string
  mediaOverlayControlBackground: string
  mediaOverlayShadow: string
}

export type AccentTokens = {
  base: string
  foreground: '#000000' | '#FFFFFF'
  subtle: string
  subtleStrong: string
  border: string
  pressed: string
  focus: string
}

export type PaletteCore = {
  canvas: string
  surface1: string
  surface2: string
  surface3: string
  border: string
  borderStrong: string
  textMain: string
  textSub: string
  textMuted: string
}
