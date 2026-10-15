# GreenField v1 rate-limit matrix

Limits are per minute unless stated otherwise. The Fastify edge key is trusted
client IP; authenticated domain safeguards additionally key by account/session,
installation, or function/action identity where the service owns that state.
`429` always uses the structured error envelope and `Retry-After`.

| Route family | Sustained/burst | Identity | Reason |
|---|---:|---|---|
| health/version | 120 | IP | Permit monitors without an unbounded public endpoint. |
| auth/session/recovery | 10 plus account/email challenge guards | IP + normalized identity | Credential stuffing and enumeration control. |
| accounts/profile/social reads | 120/60 | IP; account after auth | Normal interactive reads. |
| social writes/posts/comments/reactions | 30 | IP + account/idempotency | Spam and duplicate mutation control. |
| records/history/references/sync | 30 writes, 60 reads | IP + account/installation | Offline retry remains bounded and idempotent. |
| search | 60, query max 500 chars | IP + account | Parser/DB abuse control. |
| media | 30 mutation; configured byte ceiling | IP + account | Upload/orphan/disk abuse control. |
| sharing | 30 | IP + owner account | Share spam and enumeration control. |
| governed functions | 30 edge; declaration timeout max 120s | IP + account/installation/function | Function spam and concurrency containment. |
| inter-module actions | 30 edge and 120/source-installation service ceiling | IP + source installation | Runaway module loop/load containment. |
| intelligence | 30; provider quotas separately | account + policy/provider | Cost/privacy/provider protection. |
| registry/distribution plans | 120 | IP/account | Browse and plan creation. |
| artifact authorization/download | 240 auth checks | IP/account/installation | Range/download support without cheap DB flood. |
| settings | 30 writes, 120 reads | IP + account/installation | Settings spam and review enforcement. |
| admin/operator | 30 | authenticated admin capability | High-impact operational surface. |

The canonical values remain in route configuration and domain services; this
matrix is verified for family coverage by the closeout verifier.

