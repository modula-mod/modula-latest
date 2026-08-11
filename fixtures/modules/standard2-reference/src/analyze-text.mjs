export function analyzeText(input) {
  const text = typeof input?.text === 'string' ? input.text : ''
  const headings = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^#{1,6}\s+/.test(line))
    .map(line => line.replace(/^#{1,6}\s+/, ''))
  const visibleText = text
    .split(/\r?\n/)
    .map(line => line.replace(/^#{1,6}\s+/, '').replace(/^\s*-\s+\[[ xX]\]\s+/, ''))
    .join('\n')
  const words = visibleText.trim() ? visibleText.trim().split(/\s+/) : []

  return {
    ok: true,
    kind: 'markdown',
    wordCount: words.length,
    characterCount: text.length,
    headings,
    hasTaskList: /(?:^|\n)\s*-\s+\[[ xX]\]/.test(text),
  }
}
