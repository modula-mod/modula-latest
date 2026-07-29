#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/src/ai/tool-broker.ts', [
  'executeSafeTool',
  'ai.tools.execute',
  'Only read-only AI tools may execute',
  'greenfield.metadata.read',
  'validateStructuredOutput',
], 'AI tool broker executes only approved read-only deterministic tools')

verifierIncludes('services/greenfield-api/src/ai/provider-runtime-service.ts', [
  'executeTool',
  'maxToolCalls',
  'AI_TOOL_LIMIT_EXCEEDED',
  'AI_PROVIDER_RESPONSE_INVALID',
], 'AI runtime connects provider tool requests to the broker with bounded calls')

verifierIncludes('services/greenfield-api/src/ai/providers/mock-provider.ts', [
  'tool.requested',
  'executeRequestedTool',
  'deterministicText',
], 'Mock provider proves provider-requested tool execution without product AI features')

verifierIncludes('services/greenfield-api/tests/phase7e.ai-provider-runtime.test.ts', [
  'executes only approved read-only tools',
  'greenfield_ai_tool_runs',
  'greenfield.metadata.read',
], 'AI tool tests cover broker execution and redacted run persistence')

finish('Phase 7E AI tools verifier')
