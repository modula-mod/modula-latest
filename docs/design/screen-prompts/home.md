# Prototype brief: Home

**Phase:** 7M-B only. Not authorised in 7M-A.

High-density social Home:

`top shell → Stories → feed selector → lightweight composer entry → continuous feed`

Content dominates; chrome is quiet. Stories stay unmistakably visible. Following / For You / Modules uses the canonical segmented control. Posts are not dashboard cards.

Floating bottom navigation may use spatial/glass material but must remain readable over all content and Surface Types.

## Must prove

- Shell and navigation (`PlatformTabs`, drawer/account panel)
- Progressive blur as chrome only
- Stories rail
- Segmented feed modes
- Feed density
- Post Card composition (existing `social-post` / `FeedPostRow`)
- Media via expo-image / expo-video
- Reactions
- Drawer physics (RNGH + Reanimated)
- Scrolling behaviour
- Surface Types

## Must not

- Boxes around boxes
- Animated blur on every cell
- FlashList install without benchmark + dependency admission
- Breaking Home feed queries or session-gated hooks from 7L-B

If this prototype is rejected, fix **this screen** before 7M-C migrates twenty others.
