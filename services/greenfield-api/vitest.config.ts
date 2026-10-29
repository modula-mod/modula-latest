import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ['tests/setup/database-test-isolation.ts'],
    fileParallelism: false,
    sequence: {concurrent: false},
  },
})
