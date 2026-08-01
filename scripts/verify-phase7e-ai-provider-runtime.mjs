#!/usr/bin/env node
import {
  finish,
  run,
  runIsolatedProviderRuntimeTest,
  verifierIncludes,
} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

const focusedVerifiers = [
  'verify-phase7e-ai-provider-registry.mjs',
  'verify-phase7e-ai-provider-credentials.mjs',
  'verify-phase7e-ai-routing.mjs',
  'verify-phase7e-ai-streaming.mjs',
  'verify-phase7e-ai-structured-output.mjs',
  'verify-phase7e-ai-usage-ledger.mjs',
  'verify-phase7e-ai-quotas.mjs',
  'verify-phase7e-ai-tools.mjs',
  'verify-phase7e-ai-provider-health.mjs',
  'verify-phase7e-ai-security.mjs',
]

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'executeModuleRequest',
  'evaluateAndAudit',
  'buildProviderMessages',
  'resolveCredential',
  'executeWithFailover',
  'validateOrRepairStructuredOutput',
  'recordUsage',
  'publishMetadataEvent',
], 'AI provider runtime implements policy, prompt, context, routing, execution, validation, usage and events')

verifierIncludes('services/greenfield-api/src/ai/routes.ts', [
  '/v1/ai/providers',
  '/v1/ai/models',
  '/v1/modules/:moduleId/ai/requests',
  '/v1/ai/executions/:executionId/stream',
  '/v1/ai/executions/:executionId/cancel',
  '/v1/admin/ops/ai/providers',
], 'AI provider runtime API surfaces are wired')

verifierIncludes('docs/validation/phase7e-ai-provider-runtime.md', [
  'Definition of Done',
  'No production deployment',
  'Deterministic provider',
  'Usage estimates are not billing',
], 'AI provider runtime validation document records scope and evidence commands')

for (const script of focusedVerifiers) {
  run('node', [`scripts/${script}`], script)
}

run('pnpm', ['--filter', '@modula/greenfield-contracts', 'build'], 'Greenfield AI provider contracts build')
run('pnpm', ['--filter', '@modula/greenfield-api', 'build'], 'Greenfield API provider runtime builds')
run('node', ['scripts/verify-phase7e-ai-platform-foundation.mjs'], 'prior Phase 7E AI platform foundation verifier still passes')
await runIsolatedProviderRuntimeTest()

finish('Phase 7E AI provider runtime verifier')
