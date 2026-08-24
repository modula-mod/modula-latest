#!/usr/bin/env node
import {
  finish,
  run,
  runClassified,
  runIsolatedRuntime2Test,
  verifyCapabilityRegistrySource,
  verifyDependencyRuntimeSource,
  verifyHooksSource,
  verifyJobsSource,
  verifyLifecycleSource,
  verifyPermissionsSource,
  verifyReferenceModule,
  verifyRuntimeSecuritySource,
  verifyServiceFabricSource,
  verifyStorageSource,
  verifyUiContributionsSource,
} from './phase7e-module-runtime-2-verifier-utils.mjs'

verifyDependencyRuntimeSource()
verifyCapabilityRegistrySource()
verifyServiceFabricSource()
verifyHooksSource()
verifyLifecycleSource()
verifyPermissionsSource()
verifyStorageSource()
verifyJobsSource()
verifyUiContributionsSource()
verifyRuntimeSecuritySource()
verifyReferenceModule()
run('pnpm', ['--filter', '@modula/greenfield-api...', 'build'], 'Greenfield API builds with Standard 2 runtime')
run('pnpm', ['--filter', '@modula/greenfield-worker...', 'build'], 'Greenfield worker builds with Standard 2 runtime')
run('node', ['scripts/verify-phase7e-no-product-mocks.mjs'], 'no-product-mocks verifier remains green')
await runIsolatedRuntime2Test()
runClassified('node', ['scripts/verify-phase7e-web-production-cutover.mjs'], 'web production cutover verifier passes', 'LIVE_DEPLOYMENT_FAILURE')

finish('Phase 7E module runtime 2 verifier')
