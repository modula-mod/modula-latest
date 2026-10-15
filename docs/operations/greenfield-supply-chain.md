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

The API and worker runtime base is `node:24.18.0-bookworm-slim`. PostgreSQL is
`postgres:16.9-alpine`; Redis is `redis:7.4-alpine`. Release evidence records
the resolved image digests and the OCI revision/version labels. Production
deployment accepts only an exact merged `origin/main` SHA and verifies those
labels after cutover.

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
repository. Scanner output is treated as sensitive and is not committed.

Candidate API and worker SBOMs are generated as CycloneDX JSON from the exact
images and retained with their SHA-256 digests. Trivy scans those same images
for OS/library vulnerabilities and secrets/configuration findings. A finding is
not waived merely because a package is present: the release evidence must
classify it as exploitable, unreachable, development-only, false positive, or
upgrade-required.

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
