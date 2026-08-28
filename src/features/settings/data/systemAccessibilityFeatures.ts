import type {SettingsIconDomain} from '@/theme/contracts'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'

export type SystemAccessibilityFeatureId =
  | 'voiceover'
  | 'hover-text'
  | 'read-and-speak'
  | 'voice-control'
  | 'switch-control'
  | 'keyboard'
  | 'captions'
  | 'live-captions'
  | 'live-speech'
  | 'assistive-access'

export type SystemAccessibilityFeature = {
  id: SystemAccessibilityFeatureId
  title: string
  icon: ModulaIconName
  iconDomain: SettingsIconDomain
  body: string
  footer: string
  status: 'screenReader' | 'none'
}

export const SYSTEM_ACCESSIBILITY_FEATURES: Record<
  SystemAccessibilityFeatureId,
  SystemAccessibilityFeature
> = {
  voiceover: {
    id: 'voiceover',
    title: 'VoiceOver',
    icon: 'eye',
    iconDomain: 'accessibility',
    body: 'VoiceOver is the system screen reader. Modula cannot turn it on or off.',
    footer: 'When VoiceOver is on, Modula exposes labels, traits, and grouping on chrome and posts.',
    status: 'screenReader',
  },
  'hover-text': {
    id: 'hover-text',
    title: 'Hover Text',
    icon: 'search',
    iconDomain: 'accessibility',
    body: 'Display a large-text view of items under the pointer.',
    footer:
      'Hover Text, including display mode, font, size, and colours, is an iPhone setting. Modula cannot turn it on or off or restyle the system overlay.',
    status: 'none',
  },
  'read-and-speak': {
    id: 'read-and-speak',
    title: 'Read & Speak',
    icon: 'text',
    iconDomain: 'accessibility',
    body: 'Spoken Content and Speak Screen stay in your device settings.',
    footer: 'Post and settings text stay selectable so Spoken Content can read them.',
    status: 'none',
  },
  'voice-control': {
    id: 'voice-control',
    title: 'Voice Control',
    icon: 'comment',
    iconDomain: 'speech',
    body: 'Voice Control is a system feature. Modula cannot turn it on or off.',
    footer: 'Controls expose names Voice Control can speak.',
    status: 'none',
  },
  'switch-control': {
    id: 'switch-control',
    title: 'Switch Control',
    icon: 'switch',
    iconDomain: 'interaction',
    body: 'Switch Control is a system feature. Modula cannot turn it on or off.',
    footer: 'Focusable controls keep a 44 pt minimum target.',
    status: 'none',
  },
  keyboard: {
    id: 'keyboard',
    title: 'Keyboard',
    icon: 'text',
    iconDomain: 'interaction',
    body: 'Hardware keyboards, Full Keyboard Access, and typing accommodations stay in your device settings.',
    footer: 'On web, Settings lists can be reached with Tab and arrow keys.',
    status: 'none',
  },
  captions: {
    id: 'captions',
    title: 'Captions',
    icon: 'note',
    iconDomain: 'hearing',
    body: 'Modula shows captions when the playing media includes them.',
    footer: 'Caption appearance for system video stays in your device settings.',
    status: 'none',
  },
  'live-captions': {
    id: 'live-captions',
    title: 'Live Captions',
    icon: 'comment',
    iconDomain: 'hearing',
    body: 'Live Captions is a system feature. Modula cannot turn it on or off.',
    footer: 'When the system provides live captions, they appear over the system UI, not inside Modula chrome.',
    status: 'none',
  },
  'live-speech': {
    id: 'live-speech',
    title: 'Live Speech',
    icon: 'comment',
    iconDomain: 'speech',
    body: 'Live Speech is a system feature. Modula cannot turn it on or off.',
    footer: 'Type-to-speak stays in your device settings.',
    status: 'none',
  },
  'assistive-access': {
    id: 'assistive-access',
    title: 'Assistive Access',
    icon: 'people',
    iconDomain: 'interaction',
    body: 'Assistive Access is a system feature. Modula cannot turn it on or off.',
    footer: 'Major actions stay tappable. Full Assistive Access optimisation is not claimed.',
    status: 'none',
  },
}

export function isSystemAccessibilityFeatureId(
  value: string | undefined,
): value is SystemAccessibilityFeatureId {
  return Boolean(value && value in SYSTEM_ACCESSIBILITY_FEATURES)
}
