import {readFileSync} from 'node:fs'

const files = [
  'ops/nginx/api.modula.digital.conf',
  'ops/nginx/api.modula.digital.greenfield.conf',
]
// Nginx requires a regular expression containing `{64}` to be quoted so the
// quantifier is not parsed as configuration-block syntax.
const immutableRoute = 'location ~ "^/v1/registry/(?:artifacts/[0-9a-f]{64}|releases/[^/]+/assets/[^/]+)$" {'

for (const file of files) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const start = source.indexOf(immutableRoute)
  if (start < 0) throw new Error(`${file} does not isolate immutable registry delivery from the catch-all cache policy`)
  const end = source.indexOf('\n    }', start)
  if (end < 0) throw new Error(`${file} immutable registry location is incomplete`)
  const block = source.slice(start, end)
  if (block.includes('no-store')) throw new Error(`${file} appends no-store to immutable registry delivery`)
  if (!block.includes('proxy_pass http://127.0.0.1:4020;')) throw new Error(`${file} immutable registry location does not proxy to GreenField`)
}

process.stdout.write('MODULE-DISTRIBUTION-03 nginx immutable cache contract: PASS\n')
