# GreenField v1 supply-chain baseline

Observed 2026-10-15. Re-run the commands below for every release candidate;
tool versions and vulnerability feeds are time-sensitive evidence.

## Dependency installation and audit

Production image builds use the committed `pnpm-lock.yaml` with
`pnpm install --frozen-lockfile`. The API and worker Dockerfiles copy only the
workspace manifests needed for their filtered dependency graphs. There is no
production `npm install latest` path.

The initial production dependency audit found reachable high-severity findings
in Fastify/find-my-way/fast-uri, undici, and Nodemailer. The bounded remediation
upgraded Fastify to `5.12.7`, Nodemailer to `10.1.1`, and locked safe
find-my-way, fast-uri, and undici patch releases through workspace overrides.
The filtered API/worker production graph then reported zero advisories and both
services passed typecheck and build. The wider workspace still contains
Expo/React-Native development and client dependencies with upstream findings;
those are not copied into either backend runtime image and remain a separately
tracked Native/client upgrade concern rather than a GreenField server exposure.

## CI and images

All GitHub Actions used by the Atlas contract workflow are pinned to immutable
commit SHAs. Any deliberately tag-pinned action must be recorded here before it
is accepted.

The API and worker build base is `node:24.18.0-bookworm-slim`. Their runtime
stages contain only the filtered production deployment, not the monorepo or
package-manager toolchain, and execute as the unprivileged `modula` user.
PostgreSQL is `postgres:16.9-alpine`; Redis is `redis:7.4-alpine`. Release
evidence records the resolved image digests and the OCI revision/version
labels. Production deployment accepts only an exact merged `origin/main` SHA
and verifies those labels after cutover.

## Scanners and classification

The closeout uses pinned scanner container versions:

- Gitleaks `8.30.1`, image digest beginning `sha256:c00b`;
- Syft `1.54.1`, image digest beginning `sha256:3eb`;
- Trivy `0.76.0`, image digest beginning `sha256:2416`.

Gitleaks scanned both the worktree and all 907 repository commits. The reported
candidates were manually classified as immutable Git/image revisions, lockfile
checksums, a migration literal, or synthetic test signing material. A separate
pattern scan found no private-key blocks or AWS, GitHub, or OpenAI credential
shapes. The offline production signing private key is not present in the
repository. Raw repository/config scanner output is treated as sensitive and
is not committed. The retained exact-image reports are sanitized by first
proving that their secret-finding arrays are empty.

Candidate API and worker SBOMs are generated as SPDX JSON from the exact
images and retained with their SHA-256 digests. Trivy scans those same images
for OS/library vulnerabilities and secrets/configuration findings. A finding is
not waived merely because a package is present: the release evidence must
classify it as exploitable, unreachable, development-only, false positive, or
upgrade-required.

## R1 candidate image evidence

Candidate source/container commit `855fff336e4aabbf6ca24b0b5973c23184051639`
produced the following local immutable image identities:

| Image | Image ID | Size | SBOM packages |
| --- | --- | ---: | ---: |
| API | `sha256:9f05b40754980b91981475697eb00f37a76a9d7b8fb7fbcdbd2a7964b76351dd` | 278,714,724 bytes | 282 |
| worker | `sha256:4a1ecee414ca876eb5da604931e0a28242541cec81cfaafab82adc045cd886e1` | 260,985,460 bytes | 145 |

Both images booted against migration 074, ran as `modula`, and lacked `npm` and
`npx`. API readiness and worker heartbeat passed. The final SPDX SBOM digests
are `cedf5a17a133301bc49bdba7cab91d8f39fba401a5f14bb24d173daca5160cda`
and `c7a0b015a7a6e2f5d19b53bfe2b74a1548b426a98cc5ec1eacd3728f1600274c`.

The initial runtime images copied the root workspace and package-manager
toolchain, were about 2.5 GB each, and exposed application/development findings
that were not required at runtime. The bounded Dockerfile remediation reduced
them to the sizes above and removed that graph. The retained final Trivy scan
reports no secrets and no high/critical finding with an available fixed
version. It reports 57 package occurrences per image representing 12 unique OS
advisories: one Debian `zlib1g` critical marked `will_not_fix`, five deferred
package occurrences, and 51 occurrences without a published Debian fix.

The critical `CVE-2023-45853` applies to MiniZip's
`zipOpenNewFileInZip4_6`; GreenField neither ships nor invokes a MiniZip/archive
execution path. The remaining high findings concern privileged `mount`/
`nsenter` operations, `systemd-homed`, archive utilities, ACL symlink handling,
or terminal parsing. The container runs a non-root Node process, has no Docker
socket, does not execute these utilities, accepts no shell/archive workload,
and exposes only the compiled service entry point. These are accepted as
unreachable base-image findings for this candidate and must be rescanned when a
fixed Debian/Node base becomes available. A distroless alternative was tested
and rejected because its current Node 24 base contained fixed-but-unpatched
critical OpenSSL findings; changing to that image would regress risk.

The offline Ed25519 release-signing private key was not found in the repository,
the production configuration/storage paths, or either image. The backend
assertion-signing secret present in production is a distinct online runtime
credential; registry schema and release trust store contain public keys only.
No secret value was read into or written into this evidence.

## Reproduction commands

```sh
CI=true pnpm install --frozen-lockfile --offline
pnpm audit --prod --json
docker buildx build --load --file ops/docker/greenfield-api.Dockerfile .
docker buildx build --load --file ops/docker/greenfield-worker.Dockerfile .
```

The Docker builds also require the existing read-only
`modula-module-standard` additional build context. SBOM and image scan commands
must target image IDs/digests, never a mutable `latest` tag.
