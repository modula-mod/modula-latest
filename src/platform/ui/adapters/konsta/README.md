# Konsta web adapter

This directory is the only source boundary allowed to import `konsta/react`.

Konsta supplies web visual internals. Modula owns semantic APIs, state, design tokens, overlay behavior, accessibility policy, motion, routing, and product/module contracts. Files here must stay `.web.tsx` or web-only TypeScript. Never export a Konsta component name through the product UI API.

Overlay adapters are deliberately passive: Base UI/Modula owns focus, Escape, outside dismissal, scroll locking, portal placement, positioning, gestures, and animation. Konsta overlay primitives are not mounted inside that runtime because their `opened` state and transition DOM create a second lifecycle owner. Passive surfaces consume the same Konsta theme classes and Modula-generated tokens. `konstaTheme.ts` is the only Liquid-to-`ios` mapping, and `tokens.web.ts` maps resolved Modula colors into the variables used by retained Konsta controls.

The platform-resolved `styles/load-web-styles.web.ts` entry owns the sole Konsta/Tailwind stylesheet import. Its default sibling is a native-safe no-op.

Before adding a component, record its semantic Modula owner and production consumer in `docs/ui/web-presentation.md`, add a UI Lab specimen, exercise both presentations, run the import verifier, and inspect native bundle graphs.
