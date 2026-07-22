#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []

function sh(args) {
  return execFileSync(args[0], args.slice(1), {cwd: root, encoding: 'utf8'}).trim()
}

function maybeRg(args) {
  try {
    return sh(args)
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) return ''
    throw error
  }
}

function read(rel) {
  const abs = path.join(root, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return fs.readFileSync(abs, 'utf8')
}

const directImports = maybeRg([
  'rg',
  '-n',
  "@expo/ui/(swift-ui|jetpack-compose)",
  'src',
  '--glob',
  '!src/platform/**',
])
if (directImports) errors.push(`feature-level direct Expo UI import:\n${directImports}`)

for (const rel of [
  'src/platform/ui/sheets/modula-sheet.tsx',
  'src/platform/ui/sheets/modula-sheet.native.tsx',
  'src/platform/ui/sheets/modula-sheet.web.tsx',
  'src/platform/ui/buttons/modula-button.tsx',
  'src/platform/ui/buttons/modula-button.native.tsx',
]) {
  read(rel)
}

const nativeSheet = read('src/platform/ui/sheets/modula-sheet.native.tsx')
if (!nativeSheet.includes('Host')) errors.push('native sheet adapter does not own an Expo UI Host')
if (!nativeSheet.includes('@expo/ui')) errors.push('native sheet adapter does not use Expo UI behind platform boundary')
const fallbackSheet = read('src/platform/ui/sheets/modula-sheet.web.tsx')
if (!fallbackSheet.includes('Modal') && !fallbackSheet.includes('View')) errors.push('web sheet fallback is not functional')

const host = read('src/features/modules/runtime/module-host.tsx') + read('src/features/modules/screens/ModuleHostScreen.tsx')
if (/@expo\/ui/.test(host) || /<Host\b/.test(host)) errors.push('module host owns native Expo UI directly')

const chrome = read('src/platform/ui/navigation/persistent-shell-tab-bar.tsx') + read('src/platform/ui/navigation/shell-bottom-progressive-blur.tsx')
if (!chrome.includes('PersistentShellTabBar') || !chrome.includes('ShellBottomProgressiveBlur')) {
  errors.push('validated shell chrome files were replaced or no longer expose expected contracts')
}

const riskySurfaces = maybeRg([
  'rg',
  '-n',
  '<Host|from .@expo/ui',
  'src/features',
  'src/app',
  '--glob',
  '*.tsx',
])
if (riskySurfaces) errors.push(`feature/app Host ownership leak:\n${riskySurfaces}`)

if (errors.length) {
  console.error('Phase 7B Expo UI boundary verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7B Expo UI boundary verification passed.')
