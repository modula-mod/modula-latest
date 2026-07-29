#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/src/ai/providers/contract.ts', [
  'GreenfieldAIProviderAdapter',
  'discoverModels',
  'execute',
  'stream',
  'health',
  'ProviderExecutionRequest',
], 'AI provider adapter contract is provider-neutral')

verifierIncludes('services/greenfield-api/src/ai/providers/registry.ts', [
  'GreenfieldAIProviderAdapterRegistry',
  'provider:development-mock',
  'provider:openai',
  'provider:ollama',
], 'AI provider registry includes deterministic mock, hosted OpenAI and local Ollama adapters')

verifierIncludes('services/greenfield-api/src/ai/providers/resolver.ts', [
  'fixed',
  'capability-first',
  'local-first',
  'supportsStructuredOutputs',
  'supportsStreaming',
  'circuitAllows',
], 'AI provider resolver filters capabilities, health, circuit state and routing strategy')

verifierIncludes('services/greenfield-api/migrations/025_phase7e_ai_provider_runtime.sql', [
  'provider:development-mock',
  'provider:ollama',
  'greenfield.mock.deterministic',
  'greenfield.ollama.local',
], 'AI provider runtime migration seeds mock and local provider paths')

finish('Phase 7E AI provider registry verifier')
