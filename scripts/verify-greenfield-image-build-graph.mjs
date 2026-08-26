#!/usr/bin/env node

import {readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
const failures = []
const packages = new Map()

for (const entry of readdirSync(join(root, 'packages'), {withFileTypes: true})) {
  if (!entry.isDirectory()) continue
  const directory = `packages/${entry.name}`
  try {
    const manifest = JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8'))
    packages.set(manifest.name, {directory, manifest})
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

function record(label, passed, detail) {
  console.log(`${label.padEnd(48)} ${passed ? 'PASS' : 'FAIL'}  ${detail}`)
  if (!passed) failures.push(`${label}: ${detail}`)
}

function verify(serviceDirectory, dockerfilePath) {
  const service = JSON.parse(readFileSync(join(root, serviceDirectory, 'package.json'), 'utf8'))
  const dockerfile = readFileSync(join(root, dockerfilePath), 'utf8')
  const workspaceDependencies = Object.entries(service.dependencies ?? {})
    .filter(([, version]) => version.startsWith('workspace:'))
    .map(([name]) => name)

  for (const dependency of workspaceDependencies) {
    const workspacePackage = packages.get(dependency)
    record('WORKSPACE PACKAGE RESOLVED', Boolean(workspacePackage), `${service.name} -> ${dependency}`)
    if (!workspacePackage) continue

    const copy = `COPY ${workspacePackage.directory}/package.json ${workspacePackage.directory}/`
    const build = `pnpm --filter ${dependency} build`
    const buildPosition = dockerfile.indexOf(build)
    const serviceBuildPosition = dockerfile.indexOf(`pnpm --filter ${service.name} build`)
    record('DOCKER MANIFEST COPY', dockerfile.includes(copy), `${dockerfilePath}: ${dependency}`)
    record(
      'DOCKER DEPENDENCY BUILD',
      buildPosition >= 0 && serviceBuildPosition >= 0 && buildPosition < serviceBuildPosition,
      `${dockerfilePath}: ${dependency}`,
    )

    for (const transitive of Object.entries(workspacePackage.manifest.dependencies ?? {})
      .filter(([, version]) => version.startsWith('workspace:'))
      .map(([name]) => name)) {
      const transitivePosition = dockerfile.indexOf(`pnpm --filter ${transitive} build`)
      record(
        'DOCKER DEPENDENCY ORDER',
        transitivePosition >= 0 && transitivePosition < buildPosition,
        `${dockerfilePath}: ${transitive} before ${dependency}`,
      )
    }
  }
}

console.log('MODULA GREENFIELD IMAGE BUILD GRAPH\n')
verify('services/greenfield-api', 'ops/docker/greenfield-api.Dockerfile')
verify('services/greenfield-worker', 'ops/docker/greenfield-worker.Dockerfile')

console.log('\nRESULT')
if (failures.length) {
  console.log(`GREENFIELD IMAGE BUILD GRAPH FAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log('GREENFIELD IMAGE BUILD GRAPH PASS')
