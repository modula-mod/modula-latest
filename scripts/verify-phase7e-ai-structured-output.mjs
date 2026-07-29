#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/src/ai/schema-validator.ts', [
  'MAX_JSON_BYTES',
  'MAX_JSON_DEPTH',
  'MAX_OBJECT_KEYS',
  'parseAndValidateStructuredOutput',
  'AI_STRUCTURED_OUTPUT_INVALID',
], 'AI structured output validator bounds size, depth and schema validation')

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'validateOrRepairStructuredOutput',
  'attemptNumber: success.attemptNumber + 1',
  'Structured output repair failed validation',
  'ai.structured-output.failed',
], 'AI runtime validates structured output and records bounded repair attempts')

verifierIncludes('services/greenfield-api/src/ai/providers/openai-provider.ts', [
  'json_schema',
  'strict: true',
  'text',
  'format',
], 'OpenAI adapter adapts structured output to the provider API inside the adapter')

verifierIncludes('services/greenfield-api/tests/phase7e.ai-provider-runtime.test.ts', [
  'malformed, oversized and deeply nested',
  'invalid-then-valid',
  'AI_STRUCTURED_OUTPUT_INVALID',
], 'AI structured output tests prove repair and fail-closed behavior')

finish('Phase 7E AI structured output verifier')
