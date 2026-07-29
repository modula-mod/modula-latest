#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/migrations/025_phase7e_ai_provider_runtime.sql', [
  'CREATE TABLE IF NOT EXISTS ai_executions',
  'CREATE TABLE IF NOT EXISTS ai_execution_attempts',
  'CREATE TABLE IF NOT EXISTS ai_quota_consumption',
  'request_metadata',
  'response_metadata',
], 'AI runtime migration persists lifecycle, attempts and quota consumption metadata')

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'updateRequestUsage',
  'recordUsage',
  'providerCostMinorUnits',
  'estimatedCostMicrounits',
  'ai.execution.completed',
], 'AI runtime writes authoritative usage to the existing request ledger')

verifierIncludes('services/greenfield-api/src/ai/runtime-repository.ts', [
  'executionUsageSummary',
  'normalizeUsageUnits',
  'providerCostMinorUnits',
  'currency',
], 'AI runtime repository exposes usage diagnostics without replacing the ledger')

finish('Phase 7E AI usage ledger verifier')
