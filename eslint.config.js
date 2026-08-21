// https://docs.expo.dev/guides/using-eslint/
const {defineConfig} = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*'],
    rules: {
      // pnpm workspace packages export ESM-only; eslint-plugin-import's node
      // resolver still cannot resolve @modula/* from CJS. Typecheck covers this.
      'import/no-unresolved': ['error', {ignore: ['^@modula/']}],
    },
  },
])
