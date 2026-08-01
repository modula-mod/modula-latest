#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/migrations/025_phase7e_ai_provider_runtime.sql', [
  'CREATE TABLE IF NOT EXISTS ai_provider_health',
  'CREATE TABLE IF NOT EXISTS ai_provider_runtime_state',
  'closed',
  'open',
  'half-open',
], 'AI provider health and circuit state are persisted')

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'verifyProvider',
  'recordHealth',
  'recordCircuitFailure',
  'recordCircuitSuccess',
  'ai.provider.health-changed',
], 'AI runtime verifies provider health and updates circuit state')

verifierIncludes('services/greenfield-api/src/ai/providers/openai-provider.ts', [
  'health',
  'discoverModels',
  'authentication-failed',
  'rate-limited',
], 'Hosted provider adapter reports protected health states')

verifierIncludes('services/greenfield-api/src/ai/providers/ollama-provider.ts', [
  'health',
  '/api/tags',
  'Ollama',
], 'Local provider adapter exposes a private deployment health path')

finish('Phase 7E AI provider health verifier')
