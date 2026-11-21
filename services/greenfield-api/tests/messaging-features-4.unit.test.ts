import {describe, expect, it} from 'vitest'
import {MESSAGING_FEATURES_ALL_OFF, MESSAGING_FEATURES_ALL_ON, messagingFeatures} from '../src/config/env.js'
import {messagingFeaturesCapabilities} from '../src/app/register-messaging-features-routes.js'

describe('messaging features 4 config and capabilities', () => {
  it('defaults every switch off with a 15 s scheduler interval', () => {
    const f = messagingFeatures({})
    expect(f).toEqual(MESSAGING_FEATURES_ALL_OFF)
    expect(f.schedulerIntervalMs).toBe(15_000)
    for (const [key, value] of Object.entries(f)) if (key !== 'schedulerIntervalMs') expect(value, key).toBe(false)
  })

  it('reports {enabled:false} only for switched-off features', () => {
    const caps = messagingFeaturesCapabilities({...MESSAGING_FEATURES_ALL_ON, forwarding: false, chatThemes: false})
    expect(caps.forwarding).toEqual({enabled: false})
    expect(caps.chatThemes).toEqual({enabled: false})
    expect(caps.pinnedMessages).toEqual({enabled: true, max: 10, groupAdminsOnly: true})
    expect(caps.disappearingMessages).toEqual({enabled: true, ttlOptionsSeconds: [3600, 86400, 604800, 7776000]})
    expect(Object.keys(caps).sort()).toEqual([
      'chatFolders', 'chatPins', 'chatThemes', 'disappearingMessages', 'editHistory', 'forwarding',
      'notificationLevels', 'pinnedMessages', 'quickReplies', 'savedMessages', 'scheduledMessages',
    ])
  })
})
