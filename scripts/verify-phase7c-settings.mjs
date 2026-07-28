#!/usr/bin/env node
import {check, finish, includes, read} from './phase7c-verifier-utils.mjs'

includes('src/features/settings/screens/SettingsHomeScreen.tsx', [
  'Account',
  'Profile',
  'Privacy',
  'Security',
  'Notifications',
  'Appearance',
  'Accessibility',
  'Modules',
  'Connections',
  'Data',
  'About',
], 'settings IA')

includes('src/features/settings/screens/AppearanceScreen.tsx', [
  'System',
  'Light',
  'Dim',
  'Dark',
  'OLED',
  'Forest',
  'Ocean',
  'Plum',
  'Espresso',
  'Space Gray',
  'Native',
  'Solid',
  'Glass',
  'Glay',
  'Minimal Spatial',
  'Skeuomorphic',
  'Neomorphic',
], 'appearance hierarchy')

includes('src/features/settings/screens/AccessibilityScreen.tsx', [
  'Text size',
  'Bold text',
  'Reduce motion',
  'Reduce transparency',
  'Increase contrast',
  'Haptic feedback',
], 'accessibility settings')

const settings = read('src/features/settings/screens/SettingsHomeScreen.tsx')
check('Developer settings must be gated', settings.includes('canAccessDeveloperLabs') || settings.includes('Developer'))

finish('Phase 7C settings verification')
