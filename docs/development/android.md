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

- Requires Android SDK (`ANDROID_HOME`) and a suitable JDK
- Gradle wrapper is present (`gradle-9.3.1` validated via `./gradlew --version`)
- Do not configure production signing in Phase 0 unless already available
- Do not enable OTA update publishing during Phase 0
