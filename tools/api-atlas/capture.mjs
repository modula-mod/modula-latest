#!/usr/bin/env node
import {mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {captureHostSnapshot, evidenceDir, json, sanitizeForSecretScan} from './lib.mjs'

mkdirSync(evidenceDir, {recursive: true})
const snapshot = captureHostSnapshot()
const rendered = sanitizeForSecretScan(json(snapshot))
writeFileSync(join(evidenceDir, 'production-snapshot.json'), rendered)
process.stdout.write(`Captured sanitized production evidence at ${snapshot.capturedAt}\n`)
process.stdout.write(`Runtime method routes: ${snapshot.runtimeRoutes.length}\n`)
process.stdout.write(`Database tables: ${snapshot.databaseSchema.tables.length}\n`)
process.stdout.write(`Applied migrations: ${snapshot.databaseSchema.appliedMigrations.length}\n`)
