#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []

function rel(file) {
  return path.join(root, file)
}

function exists(file) {
  return fs.existsSync(rel(file))
}

function text(file) {
  if (!exists(file)) {
    errors.push(`missing ${file}`)
    return ''
  }
  return fs.readFileSync(rel(file), 'utf8')
}

function must(file, needles, label) {
  const source = text(file)
  for (const needle of needles) {
    if (!source.includes(needle)) errors.push(`${label}: ${file} missing ${needle}`)
  }
}

must('packages/greenfield-module-ui-contracts/src/index.ts', [
  'GreenfieldModuleViewKind',
  "'collection'",
  "'settings'",
  'GreenfieldModuleActionKind',
  "'function.invoke'",
  'GreenfieldModuleFieldDefinition',
  'validateGreenfieldModuleView',
  'FORBIDDEN_KEYS',
  'remoteHtml',
  'customSql',
], 'UI contracts')

must('services/greenfield-api/migrations/010_phase7b_module_runtime.sql', [
  'greenfield_module_views',
  'greenfield_module_actions',
  'greenfield_module_record_collections',
  'greenfield_module_records',
  'greenfield_module_record_events',
  'greenfield_module_data_retention',
  'distribution_model',
], 'migration')

must('services/greenfield-api/src/modules/routes/index.ts', [
  '/v1/modules/:moduleId/views',
  '/v1/modules/:moduleId/records/:collection',
  '/v1/modules/:moduleId/actions/:actionId',
], 'routes')

must('services/greenfield-api/src/modules/runtime-access.ts', [
  'requireEnabled',
  'releaseState',
  'enforceCapability',
], 'runtime access')

must('services/greenfield-api/src/modules/record-service.ts', [
  'Unsupported sort field',
  'Unsupported filter field',
  'Collection is private by default',
  'Module record revision conflict',
  'module.record.created',
], 'record service')

must('services/greenfield-api/src/modules/action-service.ts', [
  'validateGreenfieldModuleAction',
  'record.create',
  'settings.update',
  'function.invoke',
  'greenfield_module_action_events',
], 'action service')

must('services/greenfield-api/src/modules/view-service.ts', [
  'validateGreenfieldModuleView',
  'allowedActions',
  'greenfield_module_views',
], 'view service')

must('scripts/registry/import-module.mjs', [
  'collectViewDeclarations',
  'collectCollectionDefinitions',
  'greenfield_module_views',
  'greenfield_module_actions',
  'greenfield_module_record_collections',
], 'importer')

must('services/greenfield-api/tests/phase7b.module-runtime.test.ts', [
  'rejects unsupported components and executable UI declarations',
  'rejects unsupported action names',
  'creates, queries, updates and deletes account-scoped module records',
  'denies disabled and quarantined module runtime access',
  'keeps retained data visible after reinstall',
], 'runtime tests')

if (errors.length) {
  console.error('Phase 7B module runtime verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7B module runtime verification passed.')
