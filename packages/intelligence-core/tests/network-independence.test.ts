import {describe, expect, it} from 'vitest'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules') continue
      files.push(...collectTsFiles(full))
    } else if (entry.endsWith('.ts')) {
      files.push(full)
    }
  }
  return files
}

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+['"]node:http['"]/,
  /from\s+['"]node:https['"]/,
  /from\s+['"]node:net['"]/,
  /from\s+['"]undici['"]/,
  /from\s+['"]axios['"]/,
  /from\s+['"]node-fetch['"]/,
  /from\s+['"]openai['"]/,
  /from\s+['"]@anthropic[^'"]*['"]/,
  /from\s+['"]anthropic['"]/,
  /require\(\s*['"]https?['"]\s*\)/,
  /require\(\s*['"]axios['"]\s*\)/,
]

describe('Network independence', () => {
  it('does not import HTTP clients or LLM SDKs in package sources', () => {
    const sources = collectTsFiles(join(root, 'src'))
    for (const file of sources) {
      const content = readFileSync(file, 'utf8')
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(pattern.test(content), `${file} matched ${pattern}`).toBe(false)
      }
    }
  })
})
