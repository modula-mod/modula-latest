import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const root = process.cwd()
export const errors = []

export function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

export function read(rel) {
  const abs = path.join(root, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return fs.readFileSync(abs, 'utf8')
}

export function check(label, condition) {
  if (!condition) errors.push(label)
}

export function includes(rel, needles, label = rel) {
  const source = read(rel)
  for (const needle of needles) {
    if (!source.includes(needle)) errors.push(`${label} missing ${needle}`)
  }
  return source
}

export function sh(args, options = {}) {
  return execFileSync(args[0], args.slice(1), {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

export function maybeSh(args) {
  try {
    return sh(args)
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) return ''
    throw error
  }
}

export function json(rel) {
  const source = read(rel)
  if (!source) return {}
  try {
    return JSON.parse(source)
  } catch (error) {
    errors.push(`invalid JSON ${rel}: ${error instanceof Error ? error.message : String(error)}`)
    return {}
  }
}

export function finish(name) {
  if (errors.length) {
    console.error(`${name} failed:`)
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }
  console.log(`${name} passed.`)
}
