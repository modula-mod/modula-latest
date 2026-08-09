#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const errors = []
const domain = process.env.MODULA_MAIL_DOMAIN ?? 'modula.digital'
const mailHost = process.env.MODULA_MAIL_HOST ?? `mail.${domain}`
const selector = process.env.MODULA_DKIM_SELECTOR ?? 'mail'
const expectedA = process.env.MODULA_MAIL_EXPECTED_A ?? detectPublicIpv4() ?? '87.106.40.136'
const expectedAaaa = splitList(process.env.MODULA_MAIL_EXPECTED_AAAA)
const senderMode = process.env.MODULA_MAIL_SENDER_MODE ?? 'direct'
const expectedSpfInclude = process.env.MODULA_MAIL_EXPECTED_SPF_INCLUDE
const expectedPtr = process.env.MODULA_MAIL_EXPECTED_PTR ?? `${mailHost}.`
const ptrExceptionDoc = process.env.MODULA_MAIL_PTR_EXCEPTION_DOC
const dkimPublicKeyFile =
  process.env.MODULA_DKIM_PUBLIC_KEY_FILE ?? `/usr/local/hestia/data/users/andrei/mail/${domain}.pub`

checkMx()
checkMailHostA()
checkMailHostAaaa()
checkSpf()
checkDkim()
checkDmarc()
checkPtr()

if (errors.length) {
  console.error('Phase 7I mail DNS verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7I mail DNS verification passed.')

function checkMx() {
  const mx = dig(['+short', 'MX', domain])
  const expected = new RegExp(`^10\\s+${escapeRegExp(mailHost)}\\.?$`, 'i')
  if (mx.length !== 1 || !expected.test(mx[0])) {
    errors.push(`${domain} MX is ${mx.join(' | ') || '[empty]'}, expected "10 ${mailHost}."`)
  }
  if (mx.some(line => /_dc-mx\./i.test(line))) {
    errors.push(`${domain} MX still references obsolete _dc-mx state`)
  }
}

function checkMailHostA() {
  const records = dig(['+short', 'A', mailHost])
  if (records.length !== 1 || records[0] !== expectedA) {
    errors.push(`${mailHost} A is ${records.join(', ') || '[empty]'}, expected ${expectedA}`)
  }
}

function checkMailHostAaaa() {
  const records = dig(['+short', 'AAAA', mailHost])
  if (expectedAaaa.length) {
    const missing = expectedAaaa.filter(record => !records.includes(record))
    const unexpected = records.filter(record => !expectedAaaa.includes(record))
    if (missing.length || unexpected.length) {
      errors.push(
        `${mailHost} AAAA mismatch; expected ${expectedAaaa.join(', ')}, got ${records.join(', ') || '[empty]'}`,
      )
    }
  } else if (records.length) {
    errors.push(`${mailHost} has AAAA records but no IPv6 mail endpoint is expected: ${records.join(', ')}`)
  }
}

function checkSpf() {
  const spf = txt(domain).filter(line => /^v=spf1\b/i.test(line))
  if (spf.length !== 1) {
    errors.push(`${domain} must have exactly one SPF record; found ${spf.length}`)
    return
  }

  const record = spf[0]
  if (/\+all\b/i.test(record)) errors.push(`${domain} SPF must not use +all`)

  if (senderMode === 'direct' || senderMode === 'both') {
    if (!new RegExp(`\\bip4:${escapeRegExp(expectedA)}\\b`, 'i').test(record)) {
      errors.push(`${domain} SPF does not explicitly authorize direct sender ${expectedA}`)
    }
  }

  if (senderMode === 'relay' || senderMode === 'both') {
    if (!expectedSpfInclude) {
      errors.push('MODULA_MAIL_EXPECTED_SPF_INCLUDE is required when MODULA_MAIL_SENDER_MODE is relay or both')
    } else if (!new RegExp(`\\binclude:${escapeRegExp(expectedSpfInclude)}\\b`, 'i').test(record)) {
      errors.push(`${domain} SPF does not include expected relay mechanism include:${expectedSpfInclude}`)
    }
  }
}

function checkDkim() {
  const dkimName = `${selector}._domainkey.${domain}`
  const records = txt(dkimName).filter(line => /^v=DKIM1\b/i.test(line) || /\bp=/i.test(line))
  if (records.length !== 1) {
    errors.push(`${dkimName} must have exactly one DKIM TXT record; found ${records.length}`)
    return
  }

  const publishedKey = extractTag(records[0], 'p')
  if (!publishedKey) {
    errors.push(`${dkimName} DKIM TXT record does not contain a public key`)
    return
  }

  if (!existsSync(dkimPublicKeyFile)) {
    errors.push(`local DKIM public key file missing for correspondence check: ${dkimPublicKeyFile}`)
    return
  }

  const localKey = readPublicKeyBody(dkimPublicKeyFile)
  if (!localKey) {
    errors.push(`local DKIM public key file is not parseable: ${dkimPublicKeyFile}`)
  } else if (publishedKey !== localKey) {
    errors.push(`${dkimName} public key does not match the local active signer public key`)
  }
}

function checkDmarc() {
  const dmarcName = `_dmarc.${domain}`
  const dmarc = txt(dmarcName).filter(line => /^v=DMARC1\b/i.test(line))
  if (dmarc.length !== 1) {
    errors.push(`${dmarcName} must have exactly one DMARC record; found ${dmarc.length}`)
    return
  }
  if (!/\bp=none\b/i.test(dmarc[0])) {
    errors.push(`${dmarcName} should use p=none during Phase 7I-D2.1 mail recovery`)
  }
}

function checkPtr() {
  const ptr = dig(['+short', '-x', expectedA])
  if (ptr.some(record => record.toLowerCase() === expectedPtr.toLowerCase())) return

  if (ptrExceptionDoc && existsSync(ptrExceptionDoc)) {
    const doc = readFileSync(ptrExceptionDoc, 'utf8')
    if (/PTR_RELAY_EXCEPTION:\s*true/i.test(doc)) return
  }

  errors.push(`${expectedA} PTR is ${ptr.join(', ') || '[empty]'}, expected ${expectedPtr}`)
}

function dig(args) {
  const result = spawnSync('dig', args, {encoding: 'utf8', shell: false})
  if (result.status !== 0) {
    errors.push(`dig ${args.join(' ')} exited ${result.status ?? 'without status'}`)
    return []
  }
  return (result.stdout ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function txt(name) {
  return dig(['+short', 'TXT', name]).map(normalizeTxt)
}

function normalizeTxt(line) {
  const chunks = [...line.matchAll(/"([^"]*)"/g)].map(match => match[1])
  return chunks.length ? chunks.join('') : line
}

function extractTag(record, tag) {
  const match = new RegExp(`(?:^|;)\\s*${escapeRegExp(tag)}=([^;\\s]+)`, 'i').exec(record)
  return match?.[1]
}

function readPublicKeyBody(path) {
  return readFileSync(path, 'utf8')
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function detectPublicIpv4() {
  const result = spawnSync('ip', ['-4', '-o', 'addr', 'show', 'scope', 'global'], {encoding: 'utf8', shell: false})
  if (result.status !== 0) return undefined

  for (const line of (result.stdout ?? '').split('\n')) {
    const match = /\binet\s+(\d+\.\d+\.\d+\.\d+)\//.exec(line)
    if (!match) continue
    const ip = match[1]
    if (!isPrivateIpv4(ip)) return ip
  }
  return undefined
}

function isPrivateIpv4(ip) {
  return /^(10|127)\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
}

function splitList(value) {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
