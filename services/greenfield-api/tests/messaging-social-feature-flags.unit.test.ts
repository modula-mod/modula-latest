import {describe, expect, it} from 'vitest'
import {
  loadConfig,
  messagingFeatures,
  socialFeatures,
  MESSAGING_FEATURES_ALL_OFF,
  SOCIAL_FEATURES_ALL_OFF,
  type MessagingFeaturesConfig,
  type SocialFeaturesConfig,
} from '../src/config/env.js'
import {messagingFeaturesCapabilities} from '../src/app/register-messaging-features-routes.js'

// Founder direction for #199/#200: every new MODULA_*_ENABLED switch is OFF by default and
// enabled only when its value is exactly 'true'. These tests pin that default per flag.

function configEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MODULA_ENVIRONMENT: 'development',
    MODULA_API_HOST: '127.0.0.1',
    MODULA_API_PORT: '4097',
    MODULA_PUBLIC_API_URL: 'https://api.test.modula.digital',
    MODULA_DATABASE_URL: 'postgres://test:test@127.0.0.1:5432/modula_test',
    MODULA_DATABASE_MIGRATOR_URL: 'postgres://test:test@127.0.0.1:5432/modula_test',
    MODULA_ALLOWED_ORIGINS: 'https://modula.digital',
    ...overrides,
  }
}

const SOCIAL_FLAGS: Record<string, keyof SocialFeaturesConfig> = {
  MODULA_MESSAGING_MARK_UNREAD_ENABLED: 'markUnread',
  MODULA_STORY_VIEWERS_ENABLED: 'storyViewers',
  MODULA_STORY_REACTIONS_ENABLED: 'storyReactions',
  MODULA_STORY_HIGHLIGHTS_ENABLED: 'storyHighlights',
  MODULA_LIVE_COMMENTS_ENABLED: 'liveComments',
}

const MESSAGING_FLAGS: Record<string, Exclude<keyof MessagingFeaturesConfig, 'schedulerIntervalMs'>> = {
  MODULA_MESSAGING_PINNED_MESSAGES_ENABLED: 'pinnedMessages',
  MODULA_MESSAGING_SAVED_MESSAGES_ENABLED: 'savedMessages',
  MODULA_MESSAGING_EDIT_HISTORY_ENABLED: 'editHistory',
  MODULA_MESSAGING_SCHEDULED_MESSAGES_ENABLED: 'scheduledMessages',
  MODULA_MESSAGING_DISAPPEARING_MESSAGES_ENABLED: 'disappearingMessages',
  MODULA_MESSAGING_CHAT_FOLDERS_ENABLED: 'chatFolders',
  MODULA_MESSAGING_CHAT_PINS_ENABLED: 'chatPins',
  MODULA_MESSAGING_NOTIFICATION_LEVELS_ENABLED: 'notificationLevels',
  MODULA_MESSAGING_QUICK_REPLIES_ENABLED: 'quickReplies',
  MODULA_MESSAGING_FORWARDING_ENABLED: 'forwarding',
  MODULA_MESSAGING_CHAT_THEMES_ENABLED: 'chatThemes',
}

const NOT_EXACTLY_TRUE = ['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ']

describe('social gaps v1 and messaging features 4 flags default OFF', () => {
  it('covers all 16 new flags', () => {
    expect(Object.keys(SOCIAL_FLAGS)).toHaveLength(5)
    expect(Object.keys(MESSAGING_FLAGS)).toHaveLength(11)
  })

  it('leaves every switch off when no flag is set', () => {
    const config = loadConfig(configEnv())
    expect(config.social).toEqual(SOCIAL_FEATURES_ALL_OFF)
    expect(config.messagingFeatures).toEqual(MESSAGING_FEATURES_ALL_OFF)
    for (const value of Object.values(config.social)) expect(value).toBe(false)
    for (const [key, value] of Object.entries(config.messagingFeatures)) if (key !== 'schedulerIntervalMs') expect(value, key).toBe(false)
  })

  for (const [flag, key] of Object.entries(SOCIAL_FLAGS)) {
    it(`${flag} is off unless exactly 'true'`, () => {
      expect(loadConfig(configEnv()).social[key]).toBe(false)
      for (const value of NOT_EXACTLY_TRUE) expect(loadConfig(configEnv({[flag]: value})).social[key], JSON.stringify(value)).toBe(false)
      const on = loadConfig(configEnv({[flag]: 'true'})).social
      expect(on[key]).toBe(true)
      // Turning one flag on does not turn any other on.
      expect(Object.entries(on).filter(([, v]) => v).map(([k]) => k)).toEqual([key])
    })
  }

  for (const [flag, key] of Object.entries(MESSAGING_FLAGS)) {
    it(`${flag} is off unless exactly 'true'`, () => {
      expect(loadConfig(configEnv()).messagingFeatures[key]).toBe(false)
      for (const value of NOT_EXACTLY_TRUE) expect(loadConfig(configEnv({[flag]: value})).messagingFeatures[key], JSON.stringify(value)).toBe(false)
      const on = loadConfig(configEnv({[flag]: 'true'})).messagingFeatures
      expect(on[key]).toBe(true)
      expect(Object.entries(on).filter(([k, v]) => k !== 'schedulerIntervalMs' && v).map(([k]) => k)).toEqual([key])
    })
  }

  it('hand-built configs without a features block default off too', () => {
    expect(socialFeatures({})).toEqual(SOCIAL_FEATURES_ALL_OFF)
    expect(messagingFeatures({})).toEqual(MESSAGING_FEATURES_ALL_OFF)
    expect(socialFeatures({social: {liveComments: true}})).toEqual({...SOCIAL_FEATURES_ALL_OFF, liveComments: true})
  })

  it('advertises every messaging feature as disabled by default', () => {
    const caps = messagingFeaturesCapabilities(loadConfig(configEnv()).messagingFeatures)
    for (const [key, value] of Object.entries(caps)) expect(value, key).toEqual({enabled: false})
  })
})
