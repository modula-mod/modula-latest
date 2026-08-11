#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const errors = []
const domain = process.env.MODULA_MAIL_DOMAIN ?? 'modula.digital'
const mailHost = process.env.MODULA_MAIL_HOST ?? `mail.${domain}`
const tlsPort = process.env.MODULA_MAIL_TLS_PORT ?? '587'
const eximQueueMax = Number(process.env.MODULA_EXIM_QUEUE_MAX ?? '100')
const evidenceDoc = process.env.MODULA_MAIL_PRODUCTION_EVIDENCE_DOC ?? 'docs/validation/phase7i-d-mail-production-evidence.md'
const postgresContainer = process.env.MODULA_GREENFIELD_POSTGRES_CONTAINER ?? 'modula-production-greenfield-postgres-1'
const postgresUser = process.env.MODULA_GREENFIELD_POSTGRES_USER ?? 'modula_admin'
const postgresDb = process.env.MODULA_GREENFIELD_POSTGRES_DB ?? 'modula'

checkDns()
checkServices()
checkSmtp()
checkMailboxes()
checkQueues()
checkGreenfieldPipeline()
checkExternalEvidence()

if (errors.length) {
  console.error('Phase 7I mail production verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7I mail production verification passed.')

function checkDns() {
  const result = command('node', ['scripts/verify-phase7i-mail-dns.mjs'], {allowFailure: true})
  if (result.status !== 0) {
    errors.push('DNS gate failed; run node scripts/verify-phase7i-mail-dns.mjs for record-level failures')
  }
}

function checkServices() {
  for (const service of ['exim4', 'dovecot']) {
    const active = command('systemctl', ['is-active', service], {allowFailure: true}).stdout.trim()
    if (active !== 'active') errors.push(`${service} is ${active || 'not active'}`)
  }

  const apiLive = command('curl', ['-fsS', 'http://127.0.0.1:4020/v1/health/live'], {allowFailure: true})
  if (apiLive.status !== 0) errors.push('private Greenfield API live check failed')

  const apiReady = command('curl', ['-fsS', 'http://127.0.0.1:4020/v1/health/ready'], {allowFailure: true})
  if (apiReady.status !== 0) errors.push('private Greenfield API ready check failed')

  for (const container of ['modula-production-greenfield-api-1', 'modula-production-greenfield-worker-1']) {
    const uid = command('docker', ['exec', container, 'id', '-u'], {allowFailure: true}).stdout.trim()
    if (uid !== '999') errors.push(`${container} is running as UID ${uid || '[unknown]'}, expected 999`)
  }
}

function checkSmtp() {
  const listeners = command('ss', ['-ltn'], {allowFailure: true}).stdout
  if (!new RegExp(`:${escapeRegExp(tlsPort)}\\b`).test(listeners)) {
    errors.push(`${mailHost}:${tlsPort} is not listening locally; TLS endpoint cannot pass`)
  } else {
    const tls = command(
      'openssl',
      ['s_client', '-connect', `${mailHost}:${tlsPort}`, '-starttls', 'smtp', '-servername', mailHost, '-verify_return_error'],
      {allowFailure: true, input: '\n'},
    )
    const output = `${tls.stdout}\n${tls.stderr}`
    if (tls.status !== 0 || !/Verify return code:\s*0\s*\(ok\)/i.test(output)) {
      errors.push(`${mailHost}:${tlsPort} STARTTLS certificate verification failed`)
    }
  }

  const relayProbe = command('exim', ['-bh', '203.0.113.10'], {
    input: 'HELO attacker.example\nMAIL FROM:<outside@example.net>\nRCPT TO:<victim@example.org>\nQUIT\n',
    allowFailure: true,
  })
  if (!/550 Relay not permitted/.test(relayProbe.stdout + relayProbe.stderr)) {
    errors.push('open-relay probe did not observe 550 Relay not permitted for external-to-external mail')
  }
}

function checkMailboxes() {
  for (const mailbox of ['hello', 'support', 'security']) {
    const address = `${mailbox}@${domain}`
    const route = command('exim', ['-bt', address], {allowFailure: true})
    const output = `${route.stdout}\n${route.stderr}`
    if (route.status !== 0 || /undeliverable|Unrouteable address|lookup defer|cannot be resolved/i.test(output)) {
      errors.push(`${address} is not currently routable by Exim`)
    }

    const maildir = `/var/vmail/${domain}/${mailbox}/new`
    if (!existsSync(maildir)) errors.push(`${address} maildir missing: ${maildir}`)
  }
}

function checkQueues() {
  const eximCount = Number(command('exim', ['-bpc'], {allowFailure: true}).stdout.trim())
  if (!Number.isFinite(eximCount)) {
    errors.push('exim -bpc did not return a numeric queue count')
  } else if (eximCount > eximQueueMax) {
    errors.push(`Exim queue count ${eximCount} exceeds threshold ${eximQueueMax}`)
  }

  const jobs = psql(
    "select status || ':' || count(*) from greenfield_mail_jobs group by status order by status;",
  )
  if (!jobs) return

  for (const line of jobs.split('\n').map(item => item.trim()).filter(Boolean)) {
    if (/^(queued|sending|retrying|dead-letter|dead_letter|failed):/i.test(line)) {
      errors.push(`Greenfield mail queue has non-sent jobs: ${line}`)
    }
  }
}

function checkGreenfieldPipeline() {
  const sent = psql("select count(*) from greenfield_mail_jobs where status = 'sent';")
  if (!sent) return
  const count = Number(sent.trim())
  if (!Number.isFinite(count) || count < 1) {
    errors.push('Greenfield mail pipeline has no sent mail jobs to prove worker delivery')
  }
}

function checkExternalEvidence() {
  if (!existsSync(evidenceDoc)) {
    errors.push(`missing sanitized external mail evidence document: ${evidenceDoc}`)
    return
  }

  const evidence = readFileSync(evidenceDoc, 'utf8')
  for (const marker of [
    'INBOUND_DELIVERY_PASS: true',
    'OUTBOUND_GREENFIELD_PASS: true',
    'SPF_PASS: true',
    'DKIM_PASS: true',
    'DMARC_PASS: true',
  ]) {
    if (!evidence.includes(marker)) errors.push(`external mail evidence missing marker ${marker}`)
  }

  for (const forbidden of [/token=/i, /resetToken/i, /verificationToken/i, /BEGIN PRIVATE KEY/i]) {
    if (forbidden.test(evidence)) errors.push(`external mail evidence contains forbidden sensitive pattern ${forbidden}`)
  }
}

function psql(sql) {
  const result = command(
    'docker',
    ['exec', postgresContainer, 'psql', '-U', postgresUser, '-d', postgresDb, '-Atc', sql],
    {allowFailure: true},
  )
  if (result.status !== 0) {
    errors.push(`Greenfield database query failed: ${sql}`)
    return ''
  }
  return result.stdout
}

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
