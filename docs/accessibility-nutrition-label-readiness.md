# Accessibility Nutrition Label — readiness

**Not for App Store Connect submission.** This mission does not submit anything to App Store Connect.

Apple’s Accessibility Nutrition Labels describe support for VoiceOver, Voice Control, Larger Text, Dark Interface, Distinguish Without Colour, Captions, and related capabilities. Claims must be truthful.

| Label area | Ready to claim? | Evidence | Notes |
| --- | --- | --- | --- |
| VoiceOver | **No** | Manual VoiceOver journey is NOT_RUN until Simulator interaction is unblocked | Do not mark VoiceOver Supported |
| Voice Control | **No** | Labels exist on primary controls; Voice Control not run | Designed for named controls |
| Larger Text | **Partial** | Dynamic Type via `allowFontScaling` when Text Size is System; Settings rows reflow at large `fontScale` | Need accessibility-size screenshots |
| Dark Interface | **Yes (engineering)** | Light / Dim / Dark / OLED are real appearance modes | Visual evidence still required per theme |
| Distinguish Without Colour | **Partial** | App override adds markers (unread bar, selected marks). OS Differentiate Without Color is **not detectable** in RN 0.86 | Do not claim system Differentiate Without Color inheritance |
| Captions | **No** | Only when media includes caption tracks. Feed media often has none | Do not claim captions |
| Reduced Motion | **Partial** | Resolved Reduce Motion drives motion tokens and several screens | Need Reduce Motion screenshot/video |
| Sufficient contrast | **Partial** | Increase Contrast thickens separators and borders | Contrast audit not fully recorded |

**Copy rule:** prefer “Uses your device settings” and detected **Active** over marketing “Supported”.
