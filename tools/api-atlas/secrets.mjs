#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {join} from 'node:path'
import {repoRoot} from './lib.mjs'

// The canonical verifier owns the sanitized-artifact allowlist and patterns.
// Keep this stable command as a narrow workflow entry point rather than a
// second scanner whose rules could drift.
execFileSync(process.execPath, [join(repoRoot, 'tools/api-atlas/verify.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
})
