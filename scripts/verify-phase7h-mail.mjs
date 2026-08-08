#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const errors = []

function read(rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return readFileSync(abs, 'utf8')
}

function includes(rel, markers, label) {
  const text = read(rel)
  const missing = markers.filter(marker => !text.includes(marker))
  for (const marker of missing) errors.push(`${label} missing ${marker}`)
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      MODULA_TEST_DATABASE_URL: '',
      MODULA_DATABASE_URL: process.env.MODULA_DATABASE_URL ?? 'postgres://modula:modula@127.0.0.1:5432/modula_test',
      MODULA_PUBLIC_API_URL: process.env.MODULA_PUBLIC_API_URL ?? 'http://127.0.0.1:4020',
      MODULA_ALLOWED_ORIGINS: process.env.MODULA_ALLOWED_ORIGINS ?? 'http://localhost:8081',
    },
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) errors.push(`${label} exited ${result.status ?? 'without status'}`)
}

includes(
  'services/greenfield-api/migrations/029_phase7h_mail.sql',
  [
    'CREATE TABLE greenfield_mail_jobs',
    "'queued'",
    "'sending'",
    "'sent'",
    "'retrying'",
    "'dead-letter'",
    "'invalid-recipient'",
    'recipient_hash',
  ],
  'mail migration',
)

includes(
  'services/greenfield-api/src/mail/templates.ts',
  [
    'Verify your Modula email',
    'Reset your Modula password',
    'Your Modula password changed',
    'New sign-in to Modula',
    'Your Modula email changed',
    'You are invited to Modula',
    'Modula account deletion update',
    'Plain URL:',
    'Support:',
  ],
  'mail templates',
)

includes(
  'services/greenfield-api/src/mail/service.ts',
  [
    'queueVerification',
    'queuePasswordReset',
    'queuePasswordChanged',
    'queueNewSignIn',
    'queueEmailChanged',
    'queueInvite',
    'queueAccountDeletion',
    "job_type: 'mail.deliver'",
    'recipient_hash',
    'passwordResetUrl',
    'verificationUrl',
  ],
  'mail service',
)

includes(
  'services/greenfield-api/src/accounts/service.ts',
  [
    'MailService',
    'queueVerification',
    "updateTable('greenfield_email_verifications')",
    "where('consumed_at', 'is', null)",
    'correlationId',
  ],
  'registration mail wiring',
)

includes(
  'services/greenfield-api/src/accounts/recovery.ts',
  [
    'queuePasswordReset',
    'queuePasswordChanged',
    'greenfield_sessions',
    "status: 'revoked'",
  ],
  'password recovery mail wiring',
)

includes(
  'services/greenfield-api/src/authentication/service.ts',
  ['queueNewSignIn', 'displayNameFromIdentityMetadata', 'correlationId'],
  'new sign-in mail wiring',
)

includes(
  'services/greenfield-worker/src/mail/handler.ts',
  [
    'handleMailDeliver',
    "status = 'sending'",
    "status: 'sent'",
    "status: exhausted ? 'dead-letter' : 'retrying'",
    'SMTP_AUTHENTICATION_FAILED',
    'SMTP_INVALID_RECIPIENT',
  ],
  'worker mail handler',
)

includes(
  'services/greenfield-worker/src/mail/transport.ts',
  [
    'nodemailer',
    'createTransport',
    "'authentication'",
    "'rate-limit'",
    "'DNS'",
    "'TLS'",
    "'invalid-recipient'",
    'sanitizeFailureMessage',
  ],
  'worker mail transport',
)

includes(
  'services/greenfield-worker/src/config.ts',
  [
    'MODULA_MAIL_TRANSPORT',
    'MODULA_MAIL_REQUIRED',
    'MODULA_MAIL_FROM',
    'MODULA_SMTP_HOST',
    'MODULA_SMTP_PASSWORD',
    'authenticated SMTP relay delivery',
  ],
  'worker mail config',
)

includes(
  'src/auth/screens/ResetPasswordScreen.tsx',
  ['useLocalSearchParams', "useState(params.token ?? '')"],
  'reset password link handling',
)

for (const rel of [
  'docs/architecture/transactional-email.md',
  'docs/security/email-token-security.md',
  'docs/operations/modula-mail.md',
  'docs/validation/phase7h-mail-acceptance.md',
]) {
  if (!existsSync(join(root, rel))) errors.push(`missing ${rel}`)
}

run('pnpm', ['--filter', '@modula/greenfield-api', 'typecheck'], 'greenfield api typecheck')
run('pnpm', ['--filter', '@modula/greenfield-worker', 'typecheck'], 'greenfield worker typecheck')

if (errors.length) {
  console.error('Phase 7H mail verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7H mail verification passed.')
