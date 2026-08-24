# PVP Platform Phase 2 Vault Voice reference

Recorded: 2026-08-24

Repository: `modula-mod/modula-vault-voice`

Product ID: `digital.modula.vault-notes.voice`

Kind: `addon`

Release: `vault-voice-v0.1.0`

Release commit: `df3f275a0bfd53c96add635607d72f70f65f0714`

Artifact SHA-256: `13a937cb8e7ad11aa89a3736c8cf709ba67eff0e9368164580ca041bb512c48b`

## Result

Vault Voice is an independent add-on targeting Vault Notes
`>=1.2.0 <2.0.0`. It contributes recording, playback, attachment, transcript
insertion, settings, and background transcription through declared extension
points. The core Module Host has no Voice-specific path.

The browser adapter uses the platform `MediaRecorder` API and saves the
recording through an injected host adapter. Native clients remain behind that
adapter boundary; no SwiftUI or Jetpack Compose import was added to a feature
screen. Transcription is provider-neutral.

## Acceptance

| Gate | Result |
| --- | --- |
| Separate repository and clean main | PASS |
| Add-on manifest and immutable release | PASS |
| Install, capability review, enable | PASS |
| Recording/attachment adapter | PASS (automated adapter test) |
| Playback contribution | PASS (declarative contract) |
| Offline recording retention | PASS (automated adapter test) |
| Offline transcription | `WAITING_FOR_CONNECTION` |
| Missing transcription provider | `TRANSCRIPTION_PROVIDER_UNAVAILABLE` |
| Configured test transcriber contract | PASS |
| Disable/uninstall removes contributions | PASS |
| `DELETE_DATA` removes Voice state only | PASS |
| Core Project Atlas note after Voice removal | PASS |

Commands:

```text
CI=true pnpm verify
```

```text
CI=true pnpm verify:vault-voice-reference
```

## Honest boundary

The VPS has no user-controlled microphone session and no real transcription
provider was configured. Therefore hardware capture/playback and insertion of a
real provider transcript were not claimed as device acceptance. The shipped
adapter/runtime and failure states are source- and test-proven; a founder device
run remains part of any later production release acceptance.
