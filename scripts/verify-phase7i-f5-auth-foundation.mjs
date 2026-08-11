#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const target = process.argv[2] ?? 'all'

const checks = {
  'auth-password': [
    fileContains('services/greenfield-api/src/auth/credentials/service.ts', 'findActivePasswordMethod'),
    fileContains('services/greenfield-api/src/authentication/service.ts', 'authenticationMethodId: passwordMethod.methodId'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'greenfield_authentication_methods'),
    fileContains('services/greenfield-api/migrations/031_phase7i_f5_auth_domain.sql', "'password'"),
  ],
  'auth-email-otp': [
    fileContains('services/greenfield-api/src/auth/types.ts', "'email_login'"),
    fileContains('services/greenfield-api/src/auth/challenges/service.ts', 'target_hash'),
    fileContains('services/greenfield-api/src/auth/challenges/service.ts', 'hashRateLimitKey'),
    fileContains('services/greenfield-api/src/accounts/service.ts', 'verifyEmailCode'),
    fileContains('services/greenfield-api/src/authentication/service.ts', 'requestEmailLoginCode'),
    fileContains('services/greenfield-api/src/authentication/service.ts', 'loginWithEmailCode'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', "/v1/sessions/email-code/request"),
    fileContains('services/greenfield-api/src/app/register-routes.ts', "/v1/sessions/email-code"),
    fileContains('src/data/repositories/api/ApiAuthRepository.ts', 'requestEmailSignInCode'),
    fileContains('src/auth/screens/SignInScreen.tsx', 'Continue with email code'),
    fileContains('services/greenfield-api/src/auth/credentials/service.ts', 'createEmailOtpMethod'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'CHALLENGE_EXPIRED'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'RATE_LIMITED'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'crossAccountEmailCode'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'CHALLENGE_REPLAYED'),
    fileContains('services/greenfield-api/migrations/031_phase7i_f5_auth_domain.sql', "'email_otp'"),
    fileContains('services/greenfield-api/migrations/032_phase7i_f5b_auth_mail_otp.sql', 'target_hash'),
  ],
  'auth-sessions': [
    fileContains('services/greenfield-api/src/sessions/service.ts', 'recent_authentication_at'),
    fileContains('services/greenfield-api/src/sessions/service.ts', 'authentication_strength'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'recent_authentication_at'),
  ],
  'auth-step-up': [
    fileContains('services/greenfield-api/src/auth/step-up/policy.ts', 'evaluateStepUpRequirement'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', 'requireStepUp'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/auth/step-up/totp'),
    fileContains('services/greenfield-api/src/sessions/service.ts', 'markRecentlyAuthenticated'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'dimon_operation'),
  ],
  'transactional-mail': [
    fileContains('services/greenfield-api/src/mail/contract.ts', "'verification-code'"),
    fileContains('services/greenfield-api/src/mail/contract.ts', "'passwordless-login'"),
    fileContains('services/greenfield-api/src/mail/contract.ts', "'authenticator-enabled'"),
    fileContains('services/greenfield-api/src/mail/contract.ts', "'modula-mail-activated'"),
    fileContains('services/greenfield-api/src/mail/service.ts', 'queuePasswordlessLogin'),
    fileContains('services/greenfield-api/src/mail/components.ts', 'MailCode'),
    fileContains('services/greenfield-api/src/mail/templates.ts', 'Your Modula sign-in code'),
    fileContains('services/greenfield-api/tests/mail.templates.test.ts', 'secret-token'),
    fileContains('services/greenfield-api/tests/mail.templates.test.ts', 'Support: support@modula.digital'),
    fileContains('services/greenfield-api/migrations/032_phase7i_f5b_auth_mail_otp.sql', "'account-deletion-requested'"),
  ],
  'auth-totp': [
    fileContains('services/greenfield-api/package.json', '"otplib"'),
    fileContains('services/greenfield-api/package.json', '"qrcode"'),
    fileContains('services/greenfield-api/src/auth/mfa/totp.ts', 'generateSecret'),
    fileContains('services/greenfield-api/src/auth/mfa/totp.ts', 'ConnectorCredentialEncryptionService'),
    fileContains('services/greenfield-api/src/auth/mfa/totp.ts', 'qrCodeDataUrl'),
    fileContains('services/greenfield-api/src/auth/mfa/totp.ts', 'verifyEnrollment'),
    fileContains('services/greenfield-api/src/auth/mfa/totp.ts', 'disable'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/auth/totp/enroll'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/auth/totp/verify'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/auth/totp/disable'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'enrolls authenticator MFA'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'CHALLENGE_REPLAYED'),
    fileContains('services/greenfield-api/migrations/033_phase7i_f5b_totp_recovery.sql', 'greenfield_auth_methods_totp_pending_unique'),
  ],
  'auth-passkeys': [
    fileContains('services/greenfield-api/package.json', '"@simplewebauthn/server"'),
    fileContains('services/greenfield-api/src/auth/passkeys/rp.ts', "MODULA_PASSKEY_RP_NAME = 'Modula'"),
    fileContains('services/greenfield-api/src/auth/passkeys/rp.ts', "MODULA_PASSKEY_RP_ID = 'modula.digital'"),
    fileContains('services/greenfield-api/src/auth/passkeys/service.ts', 'verifyRegistrationResponse'),
    fileContains('services/greenfield-api/src/auth/passkeys/service.ts', 'verifyAuthenticationResponse'),
    fileContains('services/greenfield-api/src/auth/passkeys/service.ts', 'consumeOpaque'),
    fileContains('services/greenfield-api/src/auth/passkeys/service.ts', 'revoked_at'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/auth/passkeys/registration/options'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/auth/passkeys/registration/verify'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/sessions/passkey/options'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/sessions/passkey'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'WebAuthnEmulator'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'invalidRp'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'cross-account'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'revokedAuth'),
    fileContains('services/greenfield-api/migrations/031_phase7i_f5_auth_domain.sql', 'backup_eligible'),
    fileContains('public/.well-known/apple-app-site-association', 'M29V4ZGUNK.digital.modula.app'),
    fileContains('public/.well-known/assetlinks.json', 'delegate_permission/common.get_login_creds'),
    fileContains('public/.well-known/assetlinks.json', 'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C'),
    fileContains('app.config.ts', 'associatedDomains'),
    fileContains('app.config.ts', 'intentFilters'),
    fileContains('ios/Modula/Modula.entitlements', 'com.apple.developer.associated-domains'),
    fileContains('scripts/verify-associated-domains.mjs', 'validatePublic'),
  ],
  'auth-recovery': [
    fileContains('services/greenfield-api/src/auth/mfa/recovery-codes.ts', 'regenerate'),
    fileContains('services/greenfield-api/src/auth/mfa/recovery-codes.ts', 'consume'),
    fileContains('services/greenfield-api/src/auth/mfa/recovery-code-utils.ts', 'hashRecoveryCode'),
    fileContains('services/greenfield-api/src/authentication/service.ts', 'loginWithRecoveryCode'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/auth/recovery-codes/regenerate'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/sessions/recovery-code'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'recoveryCodesRemaining'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'oldUnusedCodeRejected'),
    fileContains('services/greenfield-api/migrations/031_phase7i_f5_auth_domain.sql', 'greenfield_recovery_code_sets'),
  ],
  'mail-identity': [
    fileContains('services/greenfield-api/migrations/034_phase7i_f5b_mail_identity.sql', 'greenfield_reserved_identifiers'),
    fileContains('services/greenfield-api/migrations/034_phase7i_f5b_mail_identity.sql', 'greenfield_mail_identities'),
    fileContains('services/greenfield-api/migrations/034_phase7i_f5b_mail_identity.sql', 'greenfield_mail_identity_requests'),
    fileContains('services/greenfield-api/migrations/034_phase7i_f5b_mail_identity.sql', 'greenfield_mailbox_credentials'),
    fileContains('services/greenfield-api/src/accounts/handle.ts', 'greenfield_reserved_identifiers'),
    fileContains('services/greenfield-api/src/mail/identity-service.ts', 'queueProvisioningForVerifiedAccount'),
    fileContains('services/greenfield-api/src/mail/identity-service.ts', 'PROVIDER_MAILBOXES_REQUIRING_OPERATOR_ADOPTION'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/accounts/me/modula-mail'),
    fileContains('services/greenfield-api/src/app/register-routes.ts', '/v1/admin/ops/mail/identities/adopt'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'queues and provisions Modula Mail identity'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'operator_adoption_required'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'greenfield_mailbox_credentials'),
  ],
  'mail-provisioner': [
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'class ModulaMailProvisioner'),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'health()'),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'availability('),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'provision('),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'adopt('),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'suspend('),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'resume('),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'forward('),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'release('),
    fileContains('services/greenfield-worker/src/mail/provisioner.ts', 'HestiaMailProviderAdapter'),
    fileContains('services/greenfield-worker/src/jobs/runner.ts', 'mail.identity.provision'),
    fileContains('services/greenfield-worker/src/config.ts', 'MODULA_MAIL_PROVISIONER_MODE'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'processMailIdentityUntil'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'mail_identity.forwarding_applied'),
  ],
  social: [
    fileContains('services/greenfield-api/tests/phase6s.social.test.ts', 'Phase 7I-F5 two-account social golden path'),
    fileContains('services/greenfield-api/tests/phase6s.social.test.ts', "['like', 'love', 'laugh', 'fire']"),
    fileContains('services/greenfield-api/tests/phase6s.social.test.ts', 'processSocialNotification'),
    fileContains('services/greenfield-api/tests/phase6s.social.test.ts', 'quoteShare'),
    fileContains('services/greenfield-api/tests/phase6s.social.test.ts', 'blockedProfile'),
    fileContains('services/greenfield-api/tests/phase6s.social.test.ts', 'targetType: \'post\''),
    fileContains('services/greenfield-api/migrations/035_phase7i_f5b_social_reactions.sql', "'like','love','laugh','fire'"),
    fileContains('src/features/social/components/reaction-control.tsx', "{type: 'love'"),
    fileContains('src/features/social/components/reaction-control.tsx', "{type: 'laugh'"),
    fileContains('src/features/social/components/reaction-control.tsx', "{type: 'fire'"),
  ],
  stories: [
    fileContains('services/greenfield-api/tests/phase7i.f5-stories.test.ts', 'creates, displays, views, reports, deletes and expires real Story data'),
    fileContains('services/greenfield-api/tests/phase7i.f5-stories.test.ts', "targetType: 'story'"),
    fileContains('services/greenfield-api/tests/phase7i.f5-stories.test.ts', 'blockedViewer'),
    fileContains('services/greenfield-api/tests/phase7i.f5-stories.test.ts', 'expires_at'),
    fileContains('services/greenfield-api/src/domains/stories/service.ts', 'isBlockedEitherDirection'),
    fileContains('services/greenfield-api/migrations/036_phase7i_f5b_story_reports.sql', "'story'"),
  ],
  marketplace: [
    fileContains('services/greenfield-api/src/modules/routes/index.ts', '/v1/registry/modules'),
    fileContains('services/greenfield-api/src/modules/routes/index.ts', '/v1/modules/:moduleId/install-preview'),
    fileContains('services/greenfield-api/src/modules/routes/index.ts', '/v1/modules/:moduleId/update'),
    fileContains('services/greenfield-api/src/modules/routes/index.ts', '/v1/modules/:moduleId/uninstall-preview'),
    fileContains('services/greenfield-api/src/modules/routes/index.ts', '/v1/modules/:moduleId/records/:collection/:recordId/restore'),
    fileContains('services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts', '/v1/registry/modules?q=vault'),
    fileContains('services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts', 'install-preview'),
    fileContains('services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts', 'defaultSort'),
    fileContains('services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts', 'modula.vault-notes.actions.note.archive'),
    fileContains('services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts', 'records/note/${note.record_id}/restore'),
    fileContains('services/greenfield-api/tests/phase7e.module-runtime-2.test.ts', 'handleModuleUpdate'),
    fileContains('services/greenfield-api/tests/phase7e.module-runtime-2.test.ts', '/v1/modules/${moduleId}/update'),
    fileContains('services/greenfield-api/tests/phase7e.module-runtime-2.test.ts', "payload: {choice: 'keepData'}"),
    fileNotContains('src/data/repositories/api/ApiModuleRepository.ts', "'digital.modula.vault-notes'"),
    fileNotContains('src/data/repositories/api/ApiModuleRepository.ts', 'local-vault-note'),
    fileNotContains('src/data/repositories/api/ApiModuleRepository.ts', "includes('vault-notes')"),
  ],
  'live-web-release': [blocked('Live web SHA deployment verification is outside this auth-foundation slice.')],
  mainline: [blocked('Branch audit, convergence branch, fresh-main clone/build are outside this auth-foundation slice.')],
}

const aggregateOrder = [
  'auth-password',
  'auth-email-otp',
  'auth-totp',
  'auth-passkeys',
  'auth-recovery',
  'auth-sessions',
  'auth-step-up',
  'transactional-mail',
  'mail-identity',
  'mail-provisioner',
  'social',
  'stories',
  'marketplace',
  'live-web-release',
  'mainline',
]

const targets = target === 'all' || target === 'phase7i-f5' ? aggregateOrder : [target]
let failures = 0
for (const name of targets) {
  const targetChecks = checks[name]
  if (!targetChecks) {
    console.error(`UNKNOWN verifier target: ${name}`)
    failures += 1
    continue
  }
  console.log(`\n${name}`)
  for (const check of targetChecks) {
    const result = check()
    console.log(`${result.ok ? 'PASS' : 'BLOCKED'} ${result.message}`)
    if (!result.ok) failures += 1
  }
}

if (failures > 0) {
  console.error(`\nPhase 7I-F5 verifier blocked: ${failures} unmet check(s).`)
  process.exit(1)
}

console.log('\nPhase 7I-F5 auth-foundation verifier passed.')

function fileContains(relativePath, text) {
  return () => {
    const fullPath = path.join(repoRoot, relativePath)
    if (!fs.existsSync(fullPath)) return {ok: false, message: `${relativePath} missing`}
    const body = fs.readFileSync(fullPath, 'utf8')
    return body.includes(text)
      ? {ok: true, message: `${relativePath} contains ${JSON.stringify(text)}`}
      : {ok: false, message: `${relativePath} missing ${JSON.stringify(text)}`}
  }
}

function fileNotContains(relativePath, text) {
  return () => {
    const fullPath = path.join(repoRoot, relativePath)
    if (!fs.existsSync(fullPath)) return {ok: false, message: `${relativePath} missing`}
    const body = fs.readFileSync(fullPath, 'utf8')
    return !body.includes(text)
      ? {ok: true, message: `${relativePath} does not contain ${JSON.stringify(text)}`}
      : {ok: false, message: `${relativePath} still contains ${JSON.stringify(text)}`}
  }
}

function blocked(message) {
  return () => ({ok: false, message})
}
