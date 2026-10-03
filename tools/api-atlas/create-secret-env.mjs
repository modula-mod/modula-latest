#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {closeSync, openSync, writeFileSync} from 'node:fs'

const target = process.argv[2] ?? '/etc/modula/api-atlas.env'
let fd
try {
  fd = openSync(target, 'wx', 0o600)
  const password = () => randomBytes(32).toString('base64url')
  writeFileSync(fd, [
    'API_ATLAS_IDENTITY_BOOTSTRAP=I_UNDERSTAND_THIS_CREATES_RESERVED_PRODUCTION_AUDIT_IDENTITIES',
    'API_ATLAS_BASE_URL=https://api.modula.digital',
    'API_ATLAS_A_EMAIL=api-atlas-a@audit.invalid',
    `API_ATLAS_A_PASSWORD=${password()}`,
    'API_ATLAS_B_EMAIL=api-atlas-b@audit.invalid',
    `API_ATLAS_B_PASSWORD=${password()}`,
    '',
  ].join('\n'), {mode: 0o600})
  process.stdout.write(`Created protected API Atlas credentials at ${target} (mode 0600); values were not printed.\n`)
} finally {
  if (fd !== undefined) closeSync(fd)
}
