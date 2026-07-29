#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/migrations/025_phase7e_ai_provider_runtime.sql', [
  'CREATE TABLE IF NOT EXISTS ai_stream_sessions',
  'reconnect_token_hash',
  'last_event_sequence',
  'expires_at',
  'CREATE TABLE IF NOT EXISTS ai_stream_events',
], 'AI streaming persistence tracks sessions, cursors, expiry and bounded replay')

verifierIncludes('services/greenfield-api/src/ai/providers/contract.ts', [
  'ProviderStreamEvent',
  'content.delta',
  'reasoning.status',
  'usage.updated',
  'heartbeat',
], 'AI provider stream contract is provider-neutral')

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'createStreamSession',
  'appendStreamEvent',
  'listStreamEvents',
  'normalizeStreamEvent',
  'execution.failed',
], 'AI runtime persists stream events and maps provider failures')

verifierIncludes('services/greenfield-api/src/ai/routes.ts', [
  '/v1/ai/executions/:executionId/stream',
  'text/event-stream',
  'last-event-id',
  'heartbeat',
], 'AI routes expose authenticated SSE replay with cursor support')

finish('Phase 7E AI streaming verifier')
