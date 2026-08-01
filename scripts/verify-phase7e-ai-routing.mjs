#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('packages/greenfield-contracts/src/ai.ts', [
  'ResolvedAIExecutionTarget',
  'fallbackTargets',
  'GreenfieldAIProviderRoutingStrategy',
  "'fixed'",
  "'capability-first'",
  "'local-first'",
], 'AI routing contracts expose explainable deterministic targets and fallbacks')

verifierIncludes('services/greenfield-api/src/ai/providers/resolver.ts', [
  'resolve',
  'permittedProviders',
  'preferredProviderId',
  'requiredCapabilities',
  'No AI provider model satisfies the requested capabilities',
  'fallbackTargets',
], 'AI resolver rejects missing capabilities and records fallback targets')

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'routingReason',
  'fallbackTargets',
  'canFailover',
  'streaming',
  'AI_STRUCTURED_OUTPUT_INVALID',
], 'AI runtime records routing decisions and bounds failover')

verifierIncludes('services/greenfield-api/tests/phase7e.ai-provider-runtime.test.ts', [
  'uses bounded failover',
  'FailingProviderAdapter',
  'fallbackProviderId',
], 'AI routing tests cover bounded failover')

finish('Phase 7E AI routing verifier')
