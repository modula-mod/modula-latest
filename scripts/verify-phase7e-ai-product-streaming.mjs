#!/usr/bin/env node
import {finish, includes, pass} from './phase7e-vault-notes-verifier-utils.mjs'

includes('services/greenfield-api/src/ai/product-action-service.ts', [
  'streamPath',
  '/v1/ai/executions/${result.executionId}/stream',
  'stream: input.streaming === false ? false : action.execution.streaming',
  'status: \'completed\'',
], 'product action runtime preserves provider-runtime stream replay path')

includes('services/greenfield-api/src/ai/routes.ts', [
  '/v1/ai/executions/:executionId/stream',
  'last-event-id',
  'text/event-stream',
  '/v1/ai/executions/:executionId/cancel',
], 'provider runtime stream replay and cancellation routes remain wired')

includes('src/features/modules/components/ModuleAIActionMenu.tsx', [
  'ModuleAIStreamingResult',
  'streaming',
  'Cancel',
  'Retry',
  'Copy',
], 'generic module AI UI exposes streaming and recovery states')

pass('AI product streaming uses the provider runtime stream surface without provider-specific event leakage in module UI')
finish('Phase 7E AI product streaming verifier')
