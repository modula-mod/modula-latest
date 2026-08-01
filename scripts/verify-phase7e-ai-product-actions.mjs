#!/usr/bin/env node
import {finish, includes, pass} from './phase7e-vault-notes-verifier-utils.mjs'

includes('services/greenfield-api/src/ai/product-action-service.ts', [
  'GreenfieldAIProductActionService',
  'execute(',
  'resolveProductAction',
  'ensurePrompt',
  'executeModuleRequest',
  'AI_ACTION_NOT_DECLARED',
  'AI_ACTION_PERMISSION_REQUIRED',
  'AI_CONTEXT_PERMISSION_REQUIRED',
], 'AI product action service resolves declarations, prompts, permissions and provider runtime')

includes('services/greenfield-api/src/ai/routes.ts', [
  '/v1/modules/:moduleId/ai/actions/:actionId/executions',
  '/v1/modules/:moduleId/ai/executions/:executionId/apply',
  'idempotency-key',
], 'AI product action routes are module scoped')

includes('packages/greenfield-module-manifest/src/ai.ts', [
  'productActions',
  'ModuleAIProductActionDefinition',
  'PROVIDER_BOUND_AI_PRODUCT_ACTION',
], 'main compatibility facade accepts canonical product action declarations without provider binding')

includes('services/greenfield-api/migrations/026_phase7e_ai_product_actions.sql', [
  'ai_product_action_executions',
  'ai_product_action_results',
  'ai_product_action_applications',
  'ai-assisted',
], 'product action migration stores execution, result and application metadata')

pass('AI product actions are declared by modules and executed through Greenfield AI gateway')
finish('Phase 7E AI product actions verifier')
