# Phase 5 Frontend Handoff
Backend branch: phase5-production-backend
Backend commit: 0cb1e3e01ec790011bd4737222b20633630c49e0
API URL: https://api.modula.digital
API version: v1
Protocol version: 0.1
Required frontend change: Verify remote guest mode against live API envelopes (profiles/feed/discover/activity/reels) on Mac Mission C if any decoder mismatch appears.
Affected route/component: remote data source wiring / decoders
Expected contract: Phase 4 envelopes from @modula/api-contracts shapes served by API
Current client behaviour: local simulator remains default; preview web export uses EXPO_PUBLIC_DATA_SOURCE=remote
Required acceptance test: Mission C remote API acceptance on Mac
Blocking web deployment: NO
