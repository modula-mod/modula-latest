# Phase 7L-B iPhone 17 Pro simulator golden path

Date: 2026-08-15  
Device: iPhone 17 Pro simulator (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0)  
App: `digital.modula.app` Expo dev client against `https://api.modula.digital`  
Source branch: `cursor/phase7l-b-beta-remediation-b75e`  
Parent source SHA at capture: `e80b332c7028fac83db9ef42695bf351e9b59962`

No new source P0/P1 was opened from this run. Active Sessions rendered against the still-pinned production API (`2ef3755`) with an honest load error; that was re-proved live after cutover to `e5d4b94` (`docs/validation/phase7l-b-live-golden-path.md`).

## Path captured

| Step | Evidence | Result |
| --- | --- | --- |
| Cold launch + existing native session | `01-cold-launch-home.png`, `pre-maestro-home-restored.png` | Home restored before explicit login |
| Sign out welcome | `02-welcome-after-signout.png` | Welcome sheet after drawer Sign out |
| Sign in form | `02-sign-in.png` | Email / password / Sign in |
| Password login | `03-home-e2e-login.png` | Home composer, Following feed, P7 owner avatar |
| Stories | `04-stories.png` | Home Stories rail, Your story |
| Profile | `05-profile.png` | Owner profile, Edit Profile |
| Edit Profile save | `06-profile-after-edit.png`, `06b-profile-about.png` | Save returned to Profile; About tab opened |
| Reload `/profile/:handle` | `07-profile-handle-reload.png` | Public handle surface (Follow / audience notice) |
| Drawer | `08-drawer.png` | Settings, Product Hub, Sign out |
| Settings | `09-settings.png` | Account group including Modula Mail |
| Active Sessions | `10-active-sessions.png`, `10b-active-sessions-retry.png` | Screen chrome + Devices empty copy. Load error against current production SHA — re-prove after cutover |
| Modula Mail | `11-modula-mail.png` | Honest mailbox-not-active / provisioner disabled |
| Session restore | `12-session-restore.png` | Kill/relaunch → Metro `refresh restored` → authenticated Home |
| Logout | `13-logged-out.png` | Welcome / Sign in |
| Re-login | `14-relogin-home.png` | Home again |
| Second-account public profile | `15-second-account-profile.png` | Visitor view, Follow, “No public posts yet” |

## Notes

- Metro must bind IPv4 (`--lan` / `*:8081`). `--localhost` bound `[::1]` only and the simulator failed to load `http://127.0.0.1:8081`.
- Do not place live E2E secrets in a repo-root `.env.*` file. Expo/Metro attempted to parse `.env.phase7l-b-live.local` as JS. Secrets stay under gitignored `.local-evidence/`.
- iOS “Save Password?” must be dismissed (`Not Now`) or Home assertions fail.
- Settings list rows did not receive Maestro taps; `modula://settings/account/mail` and `modula://settings/account/sessions` did.
