# Android Development

## Generate native project

```bash
pnpm prebuild:clean
```

## Run

```bash
pnpm android
```

Application ID: `digital.modula.app`

## Release smoke

```bash
cd android
./gradlew assembleRelease
cd ..
```

## Notes

- Requires Android SDK and a suitable JDK
- Do not configure production signing in Phase 0 unless already available
- Do not enable OTA update publishing during Phase 0
