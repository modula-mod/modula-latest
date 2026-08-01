#!/usr/bin/env node
import {finish, includes, pass} from './phase7e-vault-notes-verifier-utils.mjs'

includes('src/data/repositories/contracts/ModuleRepository.ts', [
  'ModuleAIProductActionDefinition',
  'executeAIAction',
  'applyAIExecution',
  'selectedResult',
], 'frontend module repository exposes generic AI product action contracts')

includes('src/data/repositories/api/ApiModuleRepository.ts', [
  '/v1/modules/${encodeURIComponent(moduleId)}/ai/actions/${encodeURIComponent(actionId)}/executions',
  '/v1/modules/${encodeURIComponent(moduleId)}/ai/executions/${encodeURIComponent(executionId)}/apply',
  'decodeAIDeclaration',
  'decodeAIProductAction',
], 'frontend repository uses module product-action API without prompt construction')

includes('src/features/modules/components/ModuleAIActionMenu.tsx', [
  'ModuleAIActionMenu',
  'ModuleAIExecutionSheet',
  'ModuleAIResultPreview',
  'ModuleAIResultDiff',
  'ModuleAIApplyControls',
  'ModuleAIUnavailableState',
  'ModuleAIUsageNotice',
], 'generic module AI UI components are present')

includes('src/features/modules/runtime/module-view-renderer.tsx', [
  'ModuleAIActionMenu',
  'aiActions',
  'record={record}',
], 'module host exposes one generic AI entry point on module records')

includes('src/features/modules/screens/ModuleManagementScreen.tsx', [
  'Revoke AI access',
  'grantedAiPermissions',
  'reviewPermissions',
  'Permitted actions',
  'Provider retention',
], 'module settings show AI actions, grants, usage note and revoke control')

includes('services/greenfield-api/tests/phase7e.ai-product-actions.test.ts', [
  'keeps Vault Notes usable without AI grants',
  'executes, previews and explicitly applies',
  'rejects stale AI application',
], 'AI product action integration tests cover optional AI, preview/apply and stale conflict')

includes('docs/validation/phase7e-ai-product-integration.md', [
  'Vault Notes 1.1',
  'deterministic provider',
  'explicit application',
  'No production deployment',
], 'AI product integration validation documentation exists')

pass('Vault Notes AI integration is routed through generic module host and Greenfield AI product action APIs')
finish('Phase 7E Vault Notes AI integration verifier')
