#!/usr/bin/env node
import {finish, maybeSh, read, errors} from './phase7c-verifier-utils.mjs'

read('docs/audits/phase7c-b-founder-alpha-completion-audit.md')

const scan = maybeSh([
  'rg',
  '-n',
  '-i',
  '\\bTODO\\b|\\bFIXME\\b|\\bTEMP\\b|\\bPLACEHOLDER\\b|\\bstub\\b|\\bdummy\\b|\\bmock\\b|coming soon|not implemented',
  'src',
  'services/greenfield-api/src',
  'services/greenfield-worker/src',
  'packages',
  '--glob',
  '!**/dist/**',
  '--glob',
  '!packages/atproto-lexicons/**',
  '--glob',
  '!packages/greenfield-module-ui-contracts/**',
  '--glob',
  '!packages/greenfield-mcp/**',
  '--glob',
  '!packages/modula-cli/**',
  '--glob',
  '!src/features/product/**',
  '--glob',
  '!src/app/product/**',
])

const allowedPathPrefixes = [
  'services/greenfield-api/src/config/',
  'services/greenfield-worker/src/config.ts',
  'services/greenfield-api/src/bridges/atproto/',
  'services/greenfield-worker/src/bridges/atproto/',
  'services/greenfield-api/src/modules/registry-service.ts',
  'src/data/repositories/contracts/ModuleRepository.ts',
  'src/data/repositories/api/ApiModuleRepository.ts',
  'src/data/repositories/api/ApiToolsRepository.ts',
  'src/features/modules/components/ModuleStatusPill.tsx',
  'src/features/modules/screens/ProductHubMarketplaceScreen.tsx',
  'src/lib/stubAction.ts',
  'src/social/adapters/',
  'src/platform/ui/skeletons/',
  'src/platform/ui/materials/camera-masked-blur.tsx',
]

for (const line of scan.split(/\r?\n/).filter(Boolean)) {
  const [path, rawLineNumber, ...rest] = line.split(':')
  const text = rest.join(':')
  if (!path || !rawLineNumber) continue
  if (allowedPathPrefixes.some(prefix => path.startsWith(prefix))) continue
  if (text.includes('placeholder=') || text.includes('placeholderTextColor')) continue
  if (text.includes('mediaPlaceholder') || text.includes('Skeleton')) continue
  if (text.includes('attempt_count') || text.includes('maximum_attempts')) continue
  if (text.includes('placeholder credentials are not allowed')) continue
  if (text.includes('DevelopmentSocialProvider')) continue
  if (text.includes('getMockFeedSnapshot')) continue
  if (text.includes('MOCK_')) continue
  if (text.includes('native-stub')) continue
  if (text.includes('files:temporary')) continue
  if (path.includes('node_modules')) continue
  errors.push(`unclassified placeholder candidate ${path}:${rawLineNumber}: ${text.trim()}`)
}

finish('Phase 7C placeholder-free verification')
