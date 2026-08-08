# Phase 7G Security Audit

Date: 2026-08-08
Status: checkpoint inventory with partial live tests. This is not a complete penetration test.

## Tests Run

| Test | Result | Evidence |
| --- | --- | --- |
| Live health exposure | PASS | `/v1/health/ready` returned ready without sensitive data. |
| Invalid login | PASS | `/v1/sessions` returned 401 `UNAUTHENTICATED`, `Invalid credentials`. |
| Registration without invite | PASS expected gate | `/v1/accounts/register` returned 403 `FORBIDDEN`, `Valid invitation required`. |
| Documented local invite against live | PASS expected reject | `test-invite` rejected with 403. |
| Remote demo credentials | PASS expected reject | local demo account credentials rejected by live API with 401. |
| Sensitive logs | NOT_ASSESSED | no server logs inspected in this checkpoint. |

## Required Security Matrix

| Boundary | Current evidence | Status | Priority | Next proof |
| --- | --- | --- | --- | --- |
| Cross-account profile mutation | write routes require `writeConfig`; repository likely scopes account | `PARTIAL` | P0 | two-account API mutation attempt |
| Cross-account Notes access | module records routes exist; Vault Notes verifier previously passes | `PARTIAL` | P0 | direct module records access attempt across accounts |
| Cross-account AI execution | AI routes require write/profile configs | `PARTIAL` | P0 | invoke/apply with another account/module |
| Cross-account media access | media routes exist | `PARTIAL` | P0 | access private story/post media across accounts |
| Cross-account notification access | notification routes use feed/profile/write configs | `PARTIAL` | P0 | fetch/mark read another account notification |
| Session replay | sessions/refresh/revoke routes exist | `PARTIAL` | P0 | replay revoked access/refresh token |
| Revoked session | route exists | `PARTIAL` | P0 | revoke then call protected route |
| Module permission bypass | runtime permission verifiers PASS | `PARTIAL` | P0 | call service/action without permission grant |
| Disabled module action | lifecycle routes exist | `PARTIAL` | P0 | disable module then invoke action/service |
| Quarantined module action | registry quarantine routes exist | `PARTIAL` | P0 | attempt install/invoke quarantined release |
| Service invocation spoofing | module service fabric verifiers PASS | `PARTIAL` | P0 | forge caller/release id |
| SSRF link preview | `GET /v1/internal/ssrf-check`, worker SSRF guard | `PARTIAL` | P0 | internal IP/file URL checks |
| Upload MIME spoofing | media/story upload paths exist | `PARTIAL` | P0 | spoof MIME/extension/oversized body |
| Oversized documents | module record APIs exist | `PARTIAL` | P1 | max payload tests |
| Admin ops access | many `/v1/admin/ops/*` routes under write/profile configs | `PARTIAL` | P0 | non-admin account attempts |

## Security Verdict

The live auth gate behaves safely for invalid credentials and invite-only registration. The main security risk is unproven authorization depth across a very broad API: modules, AI, admin ops, media, stories, and notification boundaries need direct two-account and disabled/quarantined-state tests before product release.
