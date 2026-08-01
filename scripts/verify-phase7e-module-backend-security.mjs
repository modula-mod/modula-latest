#!/usr/bin/env node
import {finish, includes} from './phase7e-module-backend-verifier-utils.mjs'

includes('packages/greenfield-module-manifest/src/backend.ts', [
  'UNSAFE_BACKEND_HOST',
  'UNSAFE_BACKEND_ORIGIN',
  'TOKEN_EXCHANGE_REQUIRED',
  'FRONTEND_ONLY_BACKEND_DECLARATION',
  'ARBITRARY_BACKEND_URL',
  'metadata.google.internal',
  '169.254.169.254',
  'a === 127',
  'localhost',
], 'manifest backend validation blocks unsafe origins and arbitrary URLs')
includes('../modula-mod/modula-module-standard/packages/module-validator/src/index.ts', [
  'denyMetadataEndpoints',
  'followRedirects',
  'METADATA_ENDPOINTS_MUST_BE_DENIED',
  'UNTRUSTED_REDIRECTS_NOT_ALLOWED',
], 'Standard backend validator enforces network policy fail-closed defaults')
includes('services/greenfield-api/src/security/ssrf.ts', [
  'assertSafeHttpsUrl',
  'safeLookup',
  'isBlockedIp',
  "inRange('127.0.0.0', 8)",
  "inRange('169.254.0.0', 16)",
  'maxRedirects',
], 'shared SSRF guard blocks loopback, link-local and unsafe redirects')
includes('services/greenfield-api/src/modules/backend/network-policy.ts', [
  'assertSafeHttpsUrl',
  'safeFetch',
  'maxRedirects: 0',
  'allowedHosts',
  'allowedOrigins',
  'parsed.origin',
], 'backend network policy resolves one safe HTTPS origin')
includes('services/greenfield-api/src/modules/backend/trust-service.ts', [
  'discovery.moduleId !== context.moduleId',
  'discovery.moduleVersion !== context.version',
  'discovery.protocolVersion !== (backend.protocolVersion ?? MODULA_MODULE_BACKEND_PROTOCOL_VERSION)',
  'backend.trust?.allowedOrigins',
  'Module backend healthUrl must use the verified backend origin',
], 'backend trust checks identity, version, protocol and same-origin health')
includes('services/greenfield-api/tests/phase7e.module-backend-runtime.test.ts', [
  'bad-signature',
  'duplicate: true',
  'not.toContain',
  'disableInstallation',
  'FORBIDDEN',
], 'runtime tests cover signature rejection, replay handling, redaction and disabled access')

finish('Phase 7E module backend security verifier')
