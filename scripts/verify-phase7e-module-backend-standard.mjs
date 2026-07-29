#!/usr/bin/env node
import {finish, includes, standardRoot, verifyStandard11Surface} from './phase7e-module-backend-verifier-utils.mjs'

verifyStandard11Surface()
includes('docs/module-backends.md', [
  'greenfield-managed',
  'module-managed',
  'hybrid',
  'frontend-only',
  'short-lived module session token',
  'Self-hosted endpoint validation',
], 'Standard backend ownership documentation exists', standardRoot)
includes('schemas/module-manifest-1.1.schema.json', [
  '"backend"',
  '"module-managed"',
  '"frontend-only"',
  '"allowedHosts"',
  '"clientAccess"',
], 'Standard 1.1 manifest schema exposes backend declaration', standardRoot)
includes('packages/greenfield-module-manifest/src/backend.ts', [
  'GREENFIELD_MODULE_BACKEND_MODES',
  'backendModeForManifest',
  'backendUsesModuleRuntime',
  'validateGreenfieldModuleBackend',
], 'Greenfield manifest package exposes backend standard boundary')

finish('Phase 7E module backend standard verifier')
