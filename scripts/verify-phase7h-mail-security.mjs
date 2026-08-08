#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const errors = []
const expectedMailA = process.env.MODULA_MAIL_EXPECTED_A ?? '87.106.40.136'
const queueMax = Number(process.env.MODULA_EXIM_QUEUE_MAX ?? '100')

if (!existsSync('docs/operations/phase7h-mail-queue-investigation.md')) {
  errors.push('missing docs/operations/phase7h-mail-queue-investigation.md')
} else {
  const doc = readFileSync('docs/operations/phase7h-mail-queue-investigation.md', 'utf8')
  for (const marker of ['Root Cause', 'Cleanup Execution', 'LOCAL_SCRIPT_SPAM', 'BOUNCE_LOOP', 'Open-relay simulation']) {
    if (!doc.includes(marker)) errors.push(`mail investigation document missing ${marker}`)
  }
}

const eximCount = Number(command('exim', ['-bpc']).stdout.trim())
if (!Number.isFinite(eximCount)) {
  errors.push('exim -bpc did not return a numeric queue count')
} else if (eximCount > queueMax) {
  errors.push(`Exim queue count ${eximCount} exceeds threshold ${queueMax}`)
}

for (const service of ['mariadb', 'exim4', 'dovecot']) {
  const active = command('systemctl', ['is-active', service], {allowFailure: true}).stdout.trim()
  if (active !== 'active') errors.push(`${service} is ${active || 'not active'}`)
  const enabled = command('systemctl', ['is-enabled', service], {allowFailure: true}).stdout.trim()
  if (enabled !== 'enabled') errors.push(`${service} is not enabled for boot`)
}

const rootCron = command('crontab', ['-l', '-u', 'root'], {allowFailure: true}).stdout
if (/\/var\/tmp\/\.dbus-daemon|pgrep -f \.dbus-daemon/.test(rootCron)) {
  errors.push('root crontab still contains .dbus-daemon queue-generator entry')
}
if (/\/home\/andrei\/scripts\/|gaia_daily_greeting\.php/.test(rootCron)) {
  errors.push('root crontab still contains dead Phase 7H mail-generating entries')
}

for (const snippet of [
  '/etc/exim4/conf.d/router/145_uninbox_mailbridge',
  '/etc/exim4/conf.d/transport/25_uninbox_pipe',
]) {
  if (existsSync(snippet)) errors.push(`broken UnInbox Exim snippet is still active: ${snippet}`)
}

const hestiaAccounts = command('/usr/local/hestia/bin/v-list-mail-accounts', ['andrei', 'modula.digital', 'json'], {
  allowFailure: true,
}).stdout
for (const mailbox of ['support', 'hello', 'security']) {
  if (!new RegExp(`"${mailbox}"\\s*:`).test(hestiaAccounts)) {
    errors.push(`required Alpha mailbox ${mailbox}@modula.digital is missing from Hestia`)
  }
}

for (const mailbox of ['andrei', 'support', 'admin']) {
  const route = command('exim', ['-bt', `${mailbox}@modula.digital`], {allowFailure: true})
  const output = `${route.stdout}\n${route.stderr}`
  if (/undeliverable|Unrouteable address|lookup defer|cannot be resolved/i.test(output)) {
    errors.push(`${mailbox}@modula.digital is not currently routable by Exim`)
  }
}

const mx = dig(['+short', 'MX', 'modula.digital'])
if (!mx.some(line => /\bmail\.modula\.digital\.?$/i.test(line))) {
  errors.push(`MX for modula.digital does not point to mail.modula.digital: ${mx.join(' | ') || '[empty]'}`)
}

const mailA = dig(['+short', 'A', 'mail.modula.digital'])
if (mailA.length !== 1 || mailA[0] !== expectedMailA) {
  errors.push(`mail.modula.digital A is ${mailA.join(', ') || '[empty]'}, expected ${expectedMailA}`)
}

const mailAaaa = dig(['+short', 'AAAA', 'mail.modula.digital'])
if (mailAaaa.length) {
  errors.push(`mail.modula.digital has AAAA records during IPv4-only mail validation: ${mailAaaa.join(', ')}`)
}

const spf = dig(['TXT', 'modula.digital']).filter(line => /"v=spf1\b/i.test(line))
if (spf.length !== 1) {
  errors.push(`modula.digital must have exactly one SPF record; found ${spf.length}`)
}

const dmarc = dig(['TXT', '_dmarc.modula.digital']).filter(line => /"v=DMARC1\b/i.test(line))
if (dmarc.length !== 1) {
  errors.push(`_dmarc.modula.digital must have exactly one DMARC record; found ${dmarc.length}`)
} else if (!/p=none\b/i.test(dmarc[0])) {
  errors.push('DMARC should be p=none during Phase 7H delivery validation')
}

const dkim = dig(['TXT', 'mail._domainkey.modula.digital'])
if (!dkim.some(line => /p=|v=DKIM1/i.test(line))) {
  errors.push('mail._domainkey.modula.digital DKIM TXT record is not published')
}

const relayProbe = command(
  'exim',
  ['-bh', '203.0.113.10'],
  {
    input: 'HELO attacker.example\nMAIL FROM:<outside@example.net>\nRCPT TO:<victim@example.org>\nQUIT\n',
    allowFailure: true,
  },
)
if (!/550 Relay not permitted/.test(relayProbe.stdout + relayProbe.stderr)) {
  errors.push('open-relay probe did not observe 550 Relay not permitted for external-to-external mail')
}

if (errors.length) {
  console.error('Phase 7H mail security verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7H mail security passed.')

function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    input: options.input,
    encoding: 'utf8',
    shell: false,
  })
  if (!options.allowFailure && result.status !== 0) {
    errors.push(`${cmd} ${args.join(' ')} exited ${result.status ?? 'without status'}`)
  }
  return {stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status}
}

function dig(args) {
  return command('dig', args).stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}
