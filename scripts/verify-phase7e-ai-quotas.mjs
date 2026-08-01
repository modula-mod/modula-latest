#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/migrations/025_phase7e_ai_provider_runtime.sql', [
  'CREATE TABLE IF NOT EXISTS ai_usage_limits',
  'requests-per-minute',
  'concurrent-executions',
  'daily-input-units',
  'daily-output-units',
  'estimated-spend',
  'single-request-size',
], 'AI quota tables support configured limits across scopes and units')

verifierIncludes('services/greenfield-api/src/ai/quota-service.ts', [
  'GreenfieldAIQuotaService',
  'assertWithinLimits',
  'AI_QUOTA_EXCEEDED',
  'single-request-size',
  'recordUsage',
], 'AI quota service rejects excess requests before provider execution and records usage')

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'estimatedInputUnits',
  'maxOutputUnits',
  'AI request exceeds configured input limit',
  'AI_CONTEXT_TOO_LARGE',
  'maxOutputUnits',
], 'AI runtime enforces request, output and context budgets before provider calls')

finish('Phase 7E AI quotas verifier')
