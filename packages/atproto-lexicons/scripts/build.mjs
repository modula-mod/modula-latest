#!/usr/bin/env node
/**
 * Emits the raw lexicon JSON documents (and a small manifest) into dist/ so
 * consumers that only need the wire-format lexicons (not the TS types) can
 * depend on the built package without reading from src/lexicons directly.
 * TypeScript output (dist/*.js, dist/*.d.ts) is produced separately by `tsc`.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const lexiconsSrcDir = path.join(root, 'lexicons')
const lexiconsDistDir = path.join(root, 'dist', 'lexicons')

function copyDir(src, dest) {
  fs.mkdirSync(dest, {recursive: true})
  for (const entry of fs.readdirSync(src, {withFileTypes: true})) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function collectLexicons(dir, base = dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectLexicons(fullPath, base))
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
      results.push({
        nsid: json.id,
        path: path.relative(base, fullPath).split(path.sep).join('/'),
      })
    }
  }
  return results
}

fs.rmSync(lexiconsDistDir, {recursive: true, force: true})
copyDir(lexiconsSrcDir, lexiconsDistDir)

const manifest = collectLexicons(lexiconsSrcDir).sort((a, b) => a.nsid.localeCompare(b.nsid))
fs.mkdirSync(path.join(root, 'dist'), {recursive: true})
fs.writeFileSync(path.join(root, 'dist', 'lexicons-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`@modula/atproto-lexicons build: copied ${manifest.length} lexicon file(s) to dist/lexicons`)
