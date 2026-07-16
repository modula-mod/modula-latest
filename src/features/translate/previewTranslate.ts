/**
 * Local translate preview — honest stub until a real translation backend lands.
 * Does not call a network API.
 */

export type TranslatePreviewResult = {
  sourceLanguage: string
  targetLanguage: string
  original: string
  translated: string
  isPreview: true
}

const PREVIEW_TARGET = 'en'

/** Lightweight heuristic: treat non-ASCII-heavy text as “other”. */
export function detectPreviewLanguage(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return 'und'
  const nonAscii = trimmed.replace(/[\x00-\x7F]/g, '').length
  if (nonAscii > trimmed.length * 0.2) return 'other'
  return 'en'
}

/**
 * Produces a clearly labelled Preview translation for UI surfaces.
 * Uses a reversible local transform so demos feel interactive without claiming accuracy.
 */
export function previewTranslatePostText(
  text: string,
  targetLanguage = PREVIEW_TARGET,
): TranslatePreviewResult {
  const original = text.trim()
  const sourceLanguage = detectPreviewLanguage(original)

  if (!original) {
    return {
      sourceLanguage,
      targetLanguage,
      original: '',
      translated: '',
      isPreview: true,
    }
  }

  // Local demo transform — not a real translator.
  const translated =
    sourceLanguage === targetLanguage
      ? `[Preview] ${original}`
      : `[Preview · ${targetLanguage}] ${original.split(/\s+/).reverse().join(' ')}`

  return {
    sourceLanguage,
    targetLanguage,
    original,
    translated,
    isPreview: true,
  }
}

export function formatTranslatePreviewMessage(result: TranslatePreviewResult): string {
  if (!result.original) {
    return 'This post has no text to translate.'
  }

  return [
    'Translate (Preview)',
    '',
    result.translated,
    '',
    'Local preview only — Modula is not connected to a translation service yet.',
  ].join('\n')
}
