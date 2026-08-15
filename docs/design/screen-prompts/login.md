# Prototype brief: Authentication

**Phase:** 7M-B only. Not authorised in 7M-A.

Create a calm, native-feeling Modula authentication entry: identity, one strong heading, one primary path, secondary methods, progressive disclosure.

Do not show password, OTP, recovery, and registration as one giant form.

## Must prove

- `ModulaTextField` / secure field / OTP composite
- Primary and secondary buttons
- Error hierarchy next to the cause
- Keyboard, AutoFill, password managers, OTP AutoFill
- Sheet or menu if used for method switching
- Native controls through adapters
- All Surface Types + Light/Dark/OLED
- Dynamic Type and web keyboard focus
- Reduce Motion

## Must not

- Stack of floating glass cards
- Neon focus rings
- Fake demo-owner auto-login
- Changing session persistence or API contracts

Existing screens to **adapt later**, not fork: `src/auth/screens/SignInScreen.tsx`, `CreateAccountScreen.tsx`, `WelcomeScreen.tsx`, `AuthScreenPrimitives.tsx`.
