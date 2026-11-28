#!/usr/bin/env tsx
/**
 * Validate a Nodus iOS release descriptor file before it is deployed.
 *
 * The descriptor is the value of MODULA_NODUS_RELEASE_IOS_JSON (see
 * docs/operations/native-endpoints-enablement.md). This script runs the same
 * check the server runs at boot (nodusReleaseDescriptorProblem, which mirrors
 * NodusModelRelease.validate() in Native), but prints the reason instead of
 * failing silent with a 404, so a bad descriptor can be fixed before deploy.
 *
 * Usage:
 *   pnpm --filter @modula/greenfield-api nodus:validate-release -- <descriptor.json>
 *
 * Exit code: 0 = valid, 1 = invalid, 2 = usage / file error.
 * Nothing from the descriptor is printed except the release version, the
 * file count, the total bytes and the manifest host (no digests, no URLs).
 */
import {readFileSync} from 'node:fs'
import {nodusReleaseDescriptorProblem, parseNodusReleaseDescriptor} from '../src/app/register-native-endpoint-routes.js'

function main(argv: string[]): number {
  // pnpm forwards a `--` separator to the script; tolerate it.
  const args = argv[0] === '--' ? argv.slice(1) : argv
  const [path] = args
  if (!path || args.length !== 1) {
    console.error('usage: validate-nodus-release-descriptor.ts <descriptor.json>')
    return 2
  }
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    console.error(`cannot read ${path}: ${(error as Error).message}`)
    return 2
  }
  const problem = nodusReleaseDescriptorProblem(raw)
  if (problem !== null) {
    console.error(`INVALID: ${problem}`)
    console.error('Fix the descriptor and re-run; the endpoint stays 404 until it validates.')
    return 1
  }
  const descriptor = parseNodusReleaseDescriptor(raw)
  if (!descriptor) {
    // Unreachable: the problem check above already passed.
    console.error('INVALID: descriptor failed validation')
    return 1
  }
  const placeholders: string[] = []
  if (descriptor.nodusVersion.includes('PLACEHOLDER')) placeholders.push('nodusVersion still contains PLACEHOLDER')
  const hosts = [descriptor.manifestURL, ...descriptor.files.map(file => file.url)].map(url => new URL(url).hostname)
  if (hosts.some(host => host === 'example.test' || host.endsWith('.example.test'))) {
    placeholders.push('URLs still point at example.test')
  }
  const totalBytes = descriptor.files.reduce((sum, file) => sum + file.bytes, 0)
  const manifestHost = new URL(descriptor.manifestURL).hostname
  console.log(
    `VALID: Nodus iOS release ${descriptor.nodusVersion} (${descriptor.files.length} files, ${totalBytes} bytes, manifest host ${manifestHost})`,
  )
  if (placeholders.length > 0) {
    console.log(
      `WARNING: template placeholder values detected (${placeholders.join('; ')}). Replace them with the real R7 release values before deploying.`,
    )
  }
  return 0
}

process.exitCode = main(process.argv.slice(2))
