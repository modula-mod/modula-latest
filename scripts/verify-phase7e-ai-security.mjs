#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/src/ai/context-builder.ts', [
  'restricted',
  'ai.context.restricted',
  'redactInlineSecrets',
  'CLASSIFICATION_PERMISSIONS',
  'redactedFragments',
], 'AI context builder denies restricted context by default and redacts sensitive fields')

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'rejectProviderBoundPayload',
  'enforceModuleAiPermissions',
  'enforceDeclaredCapabilities',
  'requireExecutionForAccount',
  'metadataForProvider',
], 'AI runtime enforces module, policy and account isolation before provider calls')

verifierIncludes('services/greenfield-api/src/ai/routes.ts', [
  'requireGreenfieldAuth',
  '/v1/modules/:moduleId/ai/requests',
  '/v1/ai/executions/:executionId',
  '/v1/admin/ops/ai/providers/:providerId/credentials',
], 'AI routes require authentication and keep credential writes operator-protected')

verifierIncludes('services/greenfield-api/tests/phase7e.ai-provider-runtime.test.ts', [
  'restricted context',
  'otherAccountId',
  'disabled modules',
  'encrypted',
], 'AI security tests cover credentials, isolation, restricted context and disabled modules')

finish('Phase 7E AI security verifier')
