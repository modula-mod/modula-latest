/**
 * Focus Mode policy model (Preview).
 * Production will use FocusPolicyEngine + surface adapters.
 */

import type {FocusPreferences} from '@/features/product/storage/productPreferencesStorage'

export type FocusPreset = 'off' | 'light' | 'deep' | 'custom'

export type FocusPolicyAnswers = {
  notificationsCanInterrupt: boolean
  feedVisible: boolean
  reelsVisible: boolean
  nonEssentialChatHeld: boolean
  gaiaUnsolicitedAllowed: boolean
  composerRecommendations: boolean
  dockQuieter: boolean
  boardPrioritisesWork: boolean
  modulesRestricted: boolean
  haloActive: boolean
}

export const FOCUS_PRESET_META: Record<
  FocusPreset,
  {title: string; summary: string; haloLabel: string | null}
> = {
  off: {
    title: 'Off',
    summary: 'Normal Modula. Feeds, chats, modules and notifications operate as permitted.',
    haloLabel: null,
  },
  light: {
    title: 'Light',
    summary:
      'Lower-priority notifications bundled, feed recommendations reduced, dock quieter, Board prioritises active work.',
    haloLabel: 'Light Focus',
  },
  deep: {
    title: 'Deep',
    summary:
      'Only selected modules visible. Feed/Reels may hide. Non-urgent chats held. GAIA avoids unsolicited interruptions. Focus Halo on.',
    haloLabel: 'Deep Focus',
  },
  custom: {
    title: 'Custom',
    summary:
      'You control contacts, modules, navigation, feed, chat, notifications, AI interruptions, duration and bypass.',
    haloLabel: 'Custom Focus',
  },
}

export function evaluateFocusPolicy(preset: FocusPreset): FocusPolicyAnswers {
  switch (preset) {
    case 'off':
      return {
        notificationsCanInterrupt: true,
        feedVisible: true,
        reelsVisible: true,
        nonEssentialChatHeld: false,
        gaiaUnsolicitedAllowed: true,
        composerRecommendations: true,
        dockQuieter: false,
        boardPrioritisesWork: false,
        modulesRestricted: false,
        haloActive: false,
      }
    case 'light':
      return {
        notificationsCanInterrupt: false,
        feedVisible: true,
        reelsVisible: true,
        nonEssentialChatHeld: false,
        gaiaUnsolicitedAllowed: true,
        composerRecommendations: true,
        dockQuieter: true,
        boardPrioritisesWork: true,
        modulesRestricted: false,
        haloActive: true,
      }
    case 'deep':
      return {
        notificationsCanInterrupt: false,
        feedVisible: false,
        reelsVisible: false,
        nonEssentialChatHeld: true,
        gaiaUnsolicitedAllowed: false,
        composerRecommendations: false,
        dockQuieter: true,
        boardPrioritisesWork: true,
        modulesRestricted: true,
        haloActive: true,
      }
    case 'custom':
      return {
        notificationsCanInterrupt: false,
        feedVisible: true,
        reelsVisible: false,
        nonEssentialChatHeld: true,
        gaiaUnsolicitedAllowed: false,
        composerRecommendations: false,
        dockQuieter: true,
        boardPrioritisesWork: true,
        modulesRestricted: true,
        haloActive: true,
      }
  }
}

/** Map a preset onto persisted Focus toggles used by Home / Board adapters. */
export function focusPreferencesFromPreset(preset: FocusPreset): FocusPreferences {
  switch (preset) {
    case 'off':
      return {
        preset: 'off',
        quietFeed: false,
        hideNav: false,
        suppressPings: false,
        priorityWork: false,
        showHalo: false,
      }
    case 'light':
      return {
        preset: 'light',
        quietFeed: true,
        hideNav: false,
        suppressPings: true,
        priorityWork: true,
        showHalo: true,
      }
    case 'deep':
      return {
        preset: 'deep',
        quietFeed: true,
        hideNav: true,
        suppressPings: true,
        priorityWork: true,
        showHalo: true,
      }
    case 'custom':
      return {
        preset: 'custom',
        quietFeed: true,
        hideNav: false,
        suppressPings: true,
        priorityWork: true,
        showHalo: true,
      }
  }
}

export function isFocusActive(focus: FocusPreferences): boolean {
  if (focus.preset && focus.preset !== 'off') return true
  return focus.quietFeed || focus.suppressPings || focus.priorityWork || focus.hideNav
}

export const FOCUS_SURFACE_ADAPTERS = [
  'FeedFocusAdapter',
  'MessagingFocusAdapter',
  'NavigationFocusAdapter',
  'BoardFocusAdapter',
  'ModuleFocusAdapter',
  'GaiaFocusAdapter',
  'NotificationFocusAdapter',
  'PresenceFocusAdapter',
] as const

export const FOCUS_POLICY_QUESTIONS: {
  key: keyof FocusPolicyAnswers
  label: string
}[] = [
  {key: 'notificationsCanInterrupt', label: 'Can notifications interrupt?'},
  {key: 'feedVisible', label: 'Is the feed fully visible?'},
  {key: 'reelsVisible', label: 'Are Reels / discovery available?'},
  {key: 'nonEssentialChatHeld', label: 'Are non-urgent chats held?'},
  {key: 'gaiaUnsolicitedAllowed', label: 'May GAIA interrupt unsolicited?'},
  {key: 'composerRecommendations', label: 'Composer recommendations on?'},
  {key: 'dockQuieter', label: 'Is the dock / drawer quieter?'},
  {key: 'boardPrioritisesWork', label: 'Does Board prioritise work?'},
  {key: 'modulesRestricted', label: 'Are modules restricted?'},
  {key: 'haloActive', label: 'Is Focus Halo active?'},
]
